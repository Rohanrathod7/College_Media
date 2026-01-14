const PDFDocument = require('pdfkit');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const { pdfToPng } = require('pdf-to-png-converter');
const path = require('path');

/**
 * PDF Service for Resume Generation and Text Extraction
 * Creates professional PDF resumes with proper formatting
 * Extracts text from PDF files for analysis
 */

class PDFService {
  /**
   * Generate PDF from resume data
   * @param {Object} resumeData - Resume content
   * @param {Object} userInfo - User information
   * @returns {PDFDocument} PDF document stream
   */
  generateResumePDF(resumeData, userInfo) {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    // Colors
    const primaryColor = '#2563eb'; // Blue
    const secondaryColor = '#64748b'; // Gray
    const textColor = '#1e293b'; // Dark gray

    // Header Section
    this.addHeader(doc, userInfo, primaryColor);
    
    // Summary Section
    if (resumeData.summary) {
      this.addSection(doc, 'Professional Summary', resumeData.summary, primaryColor, textColor);
    }

    // Experience Section
    if (resumeData.content?.experience?.length > 0) {
      this.addExperienceSection(doc, resumeData.content.experience, primaryColor, textColor, secondaryColor);
    }

    // Education Section
    if (resumeData.content?.education?.length > 0) {
      this.addEducationSection(doc, resumeData.content.education, primaryColor, textColor, secondaryColor);
    }

    // Skills Section
    if (resumeData.content?.skills?.length > 0) {
      this.addSkillsSection(doc, resumeData.content.skills, primaryColor, textColor);
    }

    // Projects Section
    if (resumeData.content?.projects?.length > 0) {
      this.addProjectsSection(doc, resumeData.content.projects, primaryColor, textColor, secondaryColor);
    }

    // Footer
    this.addFooter(doc, secondaryColor);

    return doc;
  }

  addHeader(doc, userInfo, primaryColor) {
    // Name
    doc.fontSize(24)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text(userInfo.firstName + ' ' + userInfo.lastName, { align: 'center' });

    doc.moveDown(0.3);

    // Contact Info
    doc.fontSize(10)
       .fillColor('#64748b')
       .font('Helvetica')
       .text([userInfo.email, userInfo.phone || '', userInfo.linkedin || ''].filter(Boolean).join(' • '), { align: 'center' });

    doc.moveDown(1.5);
    
    // Divider
    doc.moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .strokeColor(primaryColor)
       .lineWidth(2)
       .stroke();

    doc.moveDown(1);
  }

  addSection(doc, title, content, primaryColor, textColor) {
    // Section Title
    doc.fontSize(14)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text(title);

    doc.moveDown(0.5);

    // Content
    doc.fontSize(10)
       .fillColor(textColor)
       .font('Helvetica')
       .text(content, { align: 'justify', lineGap: 2 });

    doc.moveDown(1.5);
  }

  addExperienceSection(doc, experiences, primaryColor, textColor, secondaryColor) {
    doc.fontSize(14)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('Professional Experience');

    doc.moveDown(0.5);

    experiences.forEach((exp, index) => {
      // Job Title
      doc.fontSize(12)
         .fillColor(textColor)
         .font('Helvetica-Bold')
         .text(exp.title, { continued: true })
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text(` at ${exp.company}`);

      // Duration
      doc.fontSize(9)
         .fillColor(secondaryColor)
         .font('Helvetica-Oblique')
         .text(exp.duration);

      doc.moveDown(0.3);

      // Description
      if (exp.description) {
        const descriptions = exp.description.split('\n').filter(d => d.trim());
        descriptions.forEach(desc => {
          doc.fontSize(10)
             .fillColor(textColor)
             .font('Helvetica')
             .text('• ' + desc.replace(/^•\s*/, ''), { indent: 10, lineGap: 2 });
        });
      }

      if (index < experiences.length - 1) {
        doc.moveDown(1);
      }
    });

    doc.moveDown(1.5);
  }

  addEducationSection(doc, education, primaryColor, textColor, secondaryColor) {
    doc.fontSize(14)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('Education');

    doc.moveDown(0.5);

    education.forEach((edu, index) => {
      // Degree
      doc.fontSize(12)
         .fillColor(textColor)
         .font('Helvetica-Bold')
         .text(edu.degree, { continued: true });

      // GPA
      if (edu.gpa) {
        doc.font('Helvetica')
           .fillColor(secondaryColor)
           .text(` | GPA: ${edu.gpa}`);
      } else {
        doc.text('');
      }

      // Institution and Year
      doc.fontSize(10)
         .fillColor(secondaryColor)
         .font('Helvetica')
         .text(`${edu.institution} | ${edu.year}`);

      if (index < education.length - 1) {
        doc.moveDown(0.8);
      }
    });

    doc.moveDown(1.5);
  }

  addSkillsSection(doc, skills, primaryColor, textColor) {
    doc.fontSize(14)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('Skills');

    doc.moveDown(0.5);

    const skillText = skills.join(' • ');
    doc.fontSize(10)
       .fillColor(textColor)
       .font('Helvetica')
       .text(skillText, { lineGap: 2 });

    doc.moveDown(1.5);
  }

  addProjectsSection(doc, projects, primaryColor, textColor, secondaryColor) {
    doc.fontSize(14)
       .fillColor(primaryColor)
       .font('Helvetica-Bold')
       .text('Projects');

    doc.moveDown(0.5);

    projects.forEach((proj, index) => {
      // Project Title
      doc.fontSize(12)
         .fillColor(textColor)
         .font('Helvetica-Bold')
         .text(proj.title);

      // Link
      if (proj.link) {
        doc.fontSize(9)
           .fillColor('#2563eb')
           .font('Helvetica')
           .text(proj.link, { link: proj.link, underline: true });
      }

      doc.moveDown(0.3);

      // Description
      if (proj.description) {
        doc.fontSize(10)
           .fillColor(textColor)
           .font('Helvetica')
           .text(proj.description, { lineGap: 2 });
      }

      if (index < projects.length - 1) {
        doc.moveDown(1);
      }
    });

    doc.moveDown(1.5);
  }

  addFooter(doc, secondaryColor) {
    const footerY = 750;
    
    doc.fontSize(8)
       .fillColor(secondaryColor)
       .font('Helvetica-Oblique')
       .text(
         `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
         50,
         footerY,
         { align: 'center' }
       );
  }

  /**
   * Extract text from PDF file
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<string>} Extracted text content
   */
  async extractTextFromPDF(filePath) {
    let resumeText = '';
    
    // First attempt: pdf-parse for text-based PDFs
    try {
      console.log('📄 Attempting text extraction from PDF...');
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      
      resumeText = data.text ? data.text.trim() : '';
      console.log(`✅ Extracted ${resumeText.length} characters using pdf-parse`);
    } catch (error) {
      console.warn('⚠️ pdf-parse failed:', error.message);
      resumeText = '';
    }
    
    // If we got enough text, return it
    if (resumeText && resumeText.length > 50) {
      console.log('✅ PDF text extraction successful');
      return resumeText;
    }
    
    // Second attempt: Tesseract OCR for scanned/image-based PDFs
    console.log('🔄 Text extraction yielded minimal content, falling back to Tesseract OCR...');
    try {
      resumeText = await this.extractTextWithTesseract(filePath);
      return resumeText;
    } catch (ocrError) {
      console.error('❌ Tesseract OCR also failed:', ocrError.message);
      throw new Error('We couldn\'t read text from the uploaded resume. Please upload a text-based PDF (not scanned) or try exporting your resume again from Word or Google Docs.');
    }
  }

  /**
   * Extract text from PDF using Tesseract OCR
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<string>} Extracted text content
   */
  async extractTextWithTesseract(filePath) {
    try {
      console.log('🔍 Starting Tesseract OCR text extraction...');
      console.log('📁 PDF file path:', filePath);
      
      // Verify file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('PDF file not found at path: ' + filePath);
      }
      
      // Convert PDF to PNG images
      console.log('🔄 Converting PDF to PNG images...');
      const pngPages = await pdfToPng(filePath, {
        disableFontFace: false,
        useSystemFonts: false,
        viewportScale: 2.0
      });

      console.log(`📸 PDF converted to ${pngPages.length} image(s)`);

      if (!pngPages || pngPages.length === 0) {
        throw new Error('Failed to convert PDF to images');
      }

      let fullText = '';

      // Process each page with Tesseract
      for (let i = 0; i < pngPages.length; i++) {
        console.log(`🔍 Processing page ${i + 1}/${pngPages.length} with OCR...`);
        
        // Save image temporarily for Tesseract (it needs a file path)
        const tempImagePath = path.join(path.dirname(filePath), `temp-page-${i}-${Date.now()}.png`);
        fs.writeFileSync(tempImagePath, pngPages[i].content);
        
        try {
          const { data: { text } } = await Tesseract.recognize(
            tempImagePath,
            'eng',
            {
              logger: info => {
                if (info.status === 'recognizing text') {
                  console.log(`   OCR Progress: ${Math.round(info.progress * 100)}%`);
                }
              }
            }
          );

          fullText += text + '\n\n';
          
          // Clean up temp image
          fs.unlinkSync(tempImagePath);
        } catch (ocrError) {
          // Clean up temp image even if OCR fails
          if (fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
          }
          throw ocrError;
        }
      }

      console.log(`✅ Tesseract OCR extracted ${fullText.length} characters`);

      if (!fullText || fullText.trim().length < 50) {
        throw new Error('Tesseract OCR could not extract sufficient text from the PDF');
      }

      return fullText.trim();

    } catch (error) {
      console.error('❌ Tesseract OCR extraction failed:', error.message);
      throw new Error(`Could not extract text using Tesseract OCR: ${error.message}`);
    }
  }
}

module.exports = new PDFService();

module.exports = new PDFService();
