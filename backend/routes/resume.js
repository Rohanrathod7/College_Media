const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Resume = require('../models/Resume');
const ResumeReview = require('../models/ResumeReview');
const aiService = require('../services/aiService');
const pdfService = require('../services/pdfService');

const { protect } = require('../middleware/authMiddleware');

// Configure multer for PDF uploads
const uploadDir = path.join(__dirname, '../uploads/temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'job-desc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed for job descriptions'));
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Separate multer instance for resume uploads (accepts PDF only)
const resumeUpload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for resumes'));
    }
  }
});

// @route   POST /api/resume
// @desc    Create or Update Resume (Student)
// @access  Private (Student)
router.post('/', protect, async (req, res) => {
  try {
    const { 
      experience, 
      education, 
      skills, 
      projects,
      fileUrl, 
      status
    } = req.body;

    const resumeFields = {
      student: req.user.id,
      content: {
        experience: experience || [],
        education: education || [],
        skills: skills || [],
        projects: projects || []
      },
      fileUrl: fileUrl || null,
      status: status || 'draft'
    };

    let resume = await Resume.findOneAndUpdate(
      { student: req.user.id },
      { $set: resumeFields },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: 'Resume saved successfully',
      data: resume
    });

  } catch (err) {
    console.error('Error saving resume:', err.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   GET /api/resume/feed
// @desc    Get resumes needing review (Alumni Only)
// @access  Private (Alumni)
router.get('/feed', protect, async (req, res) => {
  try {
    if (req.user.role !== 'alumni') {
      return res.status(403).json({ success: false, message: 'Access denied. Alumni only.' });
    }

    const resumes = await Resume.find({ status: 'submitted' })
      .populate('student', ['username', 'firstName', 'lastName', 'profilePicture', 'bio'])
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: resumes.length,
      data: resumes
    });

  } catch (err) {
    console.error('Error fetching resume feed:', err.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   POST /api/resume/:id/review
// @desc    Submit a review (Alumni Only)
// @access  Private (Alumni)
router.post('/:id/review', protect, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (req.user.role !== 'alumni') {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'Access denied. Alumni only.' });
    }

    const { comments, rating, suggestions } = req.body;
    const resumeId = req.params.id;

    const resume = await Resume.findById(resumeId).session(session);
    if (!resume) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    const newReview = new ResumeReview({
      resume: resumeId,
      reviewer: req.user.id,
      comments,
      rating,
      suggestions: suggestions || []
    });

    await newReview.save({ session });

    resume.status = 'reviewed';
    resume.assignedAlumni = req.user.id;
    await resume.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Review submitted successfully',
      data: newReview
    });

  } catch (err) {
    await session.abortTransaction();
    console.error('Error submitting review:', err.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  } finally {
    session.endSession();
  }
});

// @route   POST /api/resume/generate
// @desc    Generate resume using AI
// @access  Private
router.post('/generate', protect, async (req, res) => {
  console.log('🔥 /resume/generate HIT');
  
  try {
    const { personalInfo, experience, education, skills, projects } = req.body;

    // Validate that at least some information is provided
    if (!personalInfo && (!experience || experience.length === 0) && (!education || education.length === 0)) {
      console.log('⚠️ Validation failed: insufficient data');
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide at least personal information, experience, or education details.' 
      });
    }

    console.log('➡️ Starting AI generation...');
    console.log('📊 Data received:', {
      hasPersonalInfo: !!personalInfo,
      experienceCount: experience?.length || 0,
      educationCount: education?.length || 0,
      skillsCount: skills?.length || 0,
      projectsCount: projects?.length || 0
    });

    // Generate resume using AI with timeout
    const generatedContent = await Promise.race([
      aiService.generateResume({
        personalInfo,
        experience: experience || [],
        education: education || [],
        skills: skills || [],
        projects: projects || []
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI generation timed out after 50 seconds')), 50000)
      )
    ]);

    console.log('✅ AI generation finished successfully');

    // Save the AI-generated resume
    const resumeFields = {
      student: req.user.id,
      content: {
        experience: generatedContent.experience,
        education: generatedContent.education,
        skills: generatedContent.skills,
        projects: generatedContent.projects
      },
      summary: generatedContent.summary,
      status: 'draft',
      aiGenerated: true
    };

    console.log('💾 Saving resume to database...');
    let resume = await Resume.findOneAndUpdate(
      { student: req.user.id },
      { $set: resumeFields },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log('✅ Resume saved successfully');
    res.json({
      success: true,
      message: 'Resume generated successfully using AI',
      data: resume
    });

  } catch (err) {
    console.error('❌ AI generation crashed:', err.message);
    console.error('Stack trace:', err.stack);
    return res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to generate resume. Please check your API key configuration.' 
    });
  }
});

// @route   POST /api/resume/enhance/:section
// @desc    Enhance specific section using AI
// @access  Private
router.post('/enhance/:section', protect, async (req, res) => {
  try {
    const { content } = req.body;
    const { section } = req.params;

    if (!content) {
      return res.status(400).json({ 
        success: false, 
        message: 'Content is required for enhancement.' 
      });
    }

    const enhancedContent = await aiService.enhanceSection(section, content);

    res.json({
      success: true,
      message: 'Content enhanced successfully',
      data: { enhanced: enhancedContent }
    });

  } catch (err) {
    console.error('Error enhancing content:', err.message);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to enhance content.' 
    });
  }
});

// @route   GET /api/resume/my-resume
// @desc    Get user's resume
// @access  Private
router.get('/my-resume', protect, async (req, res) => {
  try {
    const resume = await Resume.findOne({ student: req.user.id });

    if (!resume) {
      return res.status(404).json({ 
        success: false, 
        message: 'No resume found. Please create one first.' 
      });
    }

    res.json({
      success: true,
      data: resume
    });

  } catch (err) {
    console.error('Error fetching resume:', err.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   GET /api/resume/:id/download
// @desc    Download Resume as PDF
// @access  Private
router.get('/:id/download', protect, async (req, res) => {
  try {
    console.log('📄 PDF download request for resume:', req.params.id);
    
    const resume = await Resume.findById(req.params.id).populate('student', 'firstName lastName email phone linkedin');
    
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    // Check if user owns this resume or is an alumni reviewer
    if (resume.student._id.toString() !== req.user.id && req.user.role !== 'alumni') {
      return res.status(403).json({ success: false, message: 'Not authorized to download this resume' });
    }

    console.log('✅ Resume found, generating PDF...');

    // Generate PDF
    const doc = pdfService.generateResumePDF(resume, resume.student);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${resume.student.firstName}_${resume.student.lastName}_Resume.pdf"`);

    // Pipe the PDF to response
    doc.pipe(res);
    doc.end();

    console.log('✅ PDF sent successfully');

  } catch (err) {
    console.error('❌ Error generating PDF:', err);
    res.status(500).json({ success: false, message: 'Error generating PDF' });
  }
});

// @route   POST /api/resume/ats-check
// @desc    Check resume ATS compatibility
// @access  Private
router.post('/ats-check', protect, async (req, res) => {
  console.log('🔍 /resume/ats-check HIT');
  
  try {
    const { content, summary, personalInfo } = req.body;

    // Validate that resume content exists
    if (!content || (!content.experience && !content.education && !content.skills)) {
      console.log('⚠️ Validation failed: insufficient resume data');
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide resume content for ATS analysis.' 
      });
    }

    console.log('➡️ Starting ATS compatibility check...');
    console.log('📊 Analyzing resume with:', {
      hasPersonalInfo: !!personalInfo,
      hasSummary: !!summary,
      experienceCount: content.experience?.length || 0,
      educationCount: content.education?.length || 0,
      hasSkills: !!content.skills,
      projectsCount: content.projects?.length || 0
    });

    // Check ATS compatibility using AI
    const atsAnalysis = await Promise.race([
      aiService.checkATSCompatibility({ content, summary, personalInfo }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('ATS check timed out after 50 seconds')), 50000)
      )
    ]);

    console.log('✅ ATS analysis completed successfully');

    res.json({
      success: true,
      message: 'ATS compatibility check completed',
      data: atsAnalysis
    });

  } catch (err) {
    console.error('❌ ATS check failed:', err.message);
    console.error('Stack trace:', err.stack);
    return res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to complete ATS check. Please check your API key configuration.' 
    });
  }
});

// @route   POST /api/resume/optimize-for-job
// @desc    Optimize resume for specific job description
// @access  Private
router.post('/optimize-for-job', protect, async (req, res) => {
  console.log('🎯 /resume/optimize-for-job HIT');
  
  try {
    const { content, summary, personalInfo, jobDescription } = req.body;

    // Validate inputs
    if (!jobDescription || jobDescription.trim().length < 50) {
      console.log('⚠️ Validation failed: insufficient job description');
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a detailed job description (at least 50 characters).' 
      });
    }

    if (!content || (!content.experience && !content.education)) {
      console.log('⚠️ Validation failed: insufficient resume data');
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide resume content (experience or education).' 
      });
    }

    console.log('➡️ Starting job-specific optimization...');
    console.log('📊 Analyzing:', {
      jobDescriptionLength: jobDescription.length,
      hasPersonalInfo: !!personalInfo,
      hasSummary: !!summary,
      experienceCount: content.experience?.length || 0,
      educationCount: content.education?.length || 0
    });

    // Optimize resume for job description
    const optimization = await Promise.race([
      aiService.optimizeForJobDescription({ content, summary, personalInfo }, jobDescription),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Job optimization timed out after 60 seconds')), 60000)
      )
    ]);

    console.log('✅ Job optimization completed successfully');
    console.log('📈 Match Score:', optimization.matchScore);

    res.json({
      success: true,
      message: 'Resume optimized for job description',
      data: optimization
    });

  } catch (err) {
    console.error('❌ Job optimization failed:', err.message);
    console.error('Stack trace:', err.stack);
    return res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to optimize resume. Please check your API key configuration.' 
    });
  }
});

// @route   POST /api/resume/extract-job-description
// @desc    Extract text from job description PDF
// @access  Private
router.post('/extract-job-description', protect, upload.single('jobDescriptionPdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file uploaded'
      });
    }

    console.log('📄 Extracting text from job description PDF:', req.file.filename);

    // Extract text from PDF
    const extractedText = await pdfService.extractTextFromPDF(req.file.path);

    // Delete the temporary file after extraction
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    if (!extractedText || extractedText.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract sufficient text from PDF. Please ensure the PDF contains readable text (not images).'
      });
    }

    console.log(`✅ Extracted ${extractedText.length} characters from PDF`);

    res.json({
      success: true,
      message: 'Text extracted successfully from job description PDF',
      data: {
        text: extractedText,
        characterCount: extractedText.length
      }
    });

  } catch (err) {
    console.error('❌ PDF extraction failed:', err.message);
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to extract text from PDF. Please ensure the PDF is readable and try again.',
      error: err.message
    });
  }
});

// @route   POST /api/resume/analyze-resume-for-job
// @desc    Analyze uploaded resume PDF against job description
// @access  Private
router.post('/analyze-resume-for-job', protect, resumeUpload.single('resumePdf'), async (req, res) => {
  try {
    const { jobDescription } = req.body;

    console.log('📥 Resume analysis request received');
    console.log('📄 File uploaded:', req.file ? 'Yes' : 'No');
    console.log('📝 Job description:', jobDescription ? 'Yes' : 'No');

    // Validate inputs
    if (!req.file) {
      console.error('❌ No resume file uploaded');
      return res.status(400).json({
        success: false,
        message: 'Resume PDF file is required'
      });
    }

    console.log('✅ Resume file:', req.file.originalname, '(', req.file.size, 'bytes)');

    if (!jobDescription || jobDescription.trim().length < 100) {
      // Clean up uploaded file
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting temp file:', err);
        });
      }
      
      const currentLength = jobDescription ? jobDescription.trim().length : 0;
      return res.status(400).json({
        success: false,
        message: `Job description must be at least 100 characters (current: ${currentLength})`
      });
    }

    console.log('📄 Analyzing resume:', req.file.filename);
    console.log('📝 Job description length:', jobDescription.length);

    // Step 1: Extract text from resume PDF
    let resumeText;
    try {
      resumeText = await pdfService.extractTextFromPDF(req.file.path);
    } catch (extractError) {
      // Clean up file
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
      
      return res.status(400).json({
        success: false,
        message: 'Could not extract text from resume PDF. Please ensure the PDF contains readable text (not images).'
      });
    }

    // Clean up the uploaded file after extraction
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    if (!resumeText || resumeText.trim().length < 100) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract sufficient text from resume. Please ensure your PDF is readable.'
      });
    }

    console.log(`✅ Extracted ${resumeText.length} characters from resume`);

    // Step 2: Parse resume text into structured format (basic parsing)
    const resumeData = {
      content: {
        experience: [],
        education: [],
        skills: [],
        projects: []
      },
      summary: '',
      personalInfo: {
        name: '',
        email: '',
        phone: '',
        linkedin: ''
      },
      fullText: resumeText
    };

    console.log('🤖 Analyzing resume against job description with AI...');

    // Step 3: Use AI to analyze the resume against job description
    const optimization = await Promise.race([
      aiService.analyzeResumeAgainstJob(resumeText, jobDescription),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timed out after 90 seconds')), 90000)
      )
    ]);

    console.log('✅ Analysis completed successfully');
    console.log('📈 Match Score:', optimization.matchScore);

    res.json({
      success: true,
      message: 'Resume analyzed successfully against job description',
      data: optimization
    });

  } catch (err) {
    console.error('❌ Resume analysis failed:', err.message);
    console.error('Stack trace:', err.stack);
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
      });
    }

    return res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to analyze resume. Please check your API configuration.' 
    });
  }
});

module.exports = router;