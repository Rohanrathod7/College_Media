import { useState, useEffect, lazy, Suspense, useRef, useCallback } from "react";
import "./App.css";
import { Route, Routes, Link } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import LeftSidebar from "./components/LeftSidebar.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { ErrorProvider } from "./context/ErrorContext.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import { PostSkeleton } from "./components/SkeletonLoader.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import { useWebVitals, reportWebVitals } from "./hooks/useWebVitals.js";
import { performanceMonitor } from "./utils/performanceMonitor.js";
import BackButton from "./components/BackButton.jsx";
import InstallPWA from "./components/InstallPWA.jsx";
import OfflineIndicator from "./components/OfflineIndicator.jsx";

// Lazy load route components for code splitting
const Reels = lazy(() => import("./pages/Reels.jsx"));
const ContactUs = lazy(() => import("./pages/ContactUs.jsx"));
const CertificatePage = lazy(() => import("./pages/CertificatePage.jsx"));
const GamifiedAssessmentPage = lazy(() =>
  import("./pages/GamifiedAssessmentPage.jsx")
);
const AdvancedSyllabusPage = lazy(() =>
  import("./pages/AdvancedSyllabusPage.jsx")
);
const Home = lazy(() => import("./pages/Home.jsx"));
const CreatePost = lazy(() => import("./components/CreatePost.jsx"));
const CoursesLanding = lazy(() => import("./pages/CoursesLanding.jsx"));
const CourseDiscovery = lazy(() => import("./pages/CourseDiscovery.jsx"));
const LearningMode = lazy(() => import("./pages/LearningMode.jsx"));
const Landing = lazy(() => import("./pages/Landing.jsx"));
const StudyRoomPage = lazy(() => import("./pages/StudyRoomPage.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Signup = lazy(() => import("./pages/Signup.jsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));
const NotificationCenter = lazy(() =>
  import("./components/NotificationCenter.jsx")
);
const NotificationPreferences = lazy(() =>
  import("./components/NotificationPreferences.jsx")
);
const SearchResults = lazy(() => import("./pages/SearchResults.jsx"));

// Cursor Trail Component
const CursorTrail = () => {
  const trailRef = useRef([]);
  const positionsRef = useRef([]);
  const animationFrameRef = useRef(null);
  const dotCount = 20;
  const dotDistance = 10;

  const updateTrail = useCallback(() => {
    if (trailRef.current.length === 0) return;

    positionsRef.current.forEach((position, index) => {
      if (index === 0) return;

      const prevPosition = positionsRef.current[index - 1];
      const dx = prevPosition.x - position.x;
      const dy = prevPosition.y - position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > dotDistance) {
        const angle = Math.atan2(dy, dx);
        position.x += Math.cos(angle) * (distance - dotDistance) * 0.8;
        position.y += Math.sin(angle) * (distance - dotDistance) * 0.8;
      }

      const dot = trailRef.current[index];
      if (dot) {
        const size = 6 - (index / dotCount) * 4;
        dot.style.width = `${size}px`;
        dot.style.height = `${size}px`;
        dot.style.left = `${position.x - size / 2}px`;
        dot.style.top = `${position.y - size / 2}px`;
        
        // Create gradient color based on position
        const hue = (Date.now() / 20 + index * 10) % 360;
        dot.style.backgroundColor = `hsl(${hue}, 70%, 60%)`;
        dot.style.opacity = 0.8 - (index / dotCount) * 0.7;
      }
    });

    animationFrameRef.current = requestAnimationFrame(updateTrail);
  }, []);

  useEffect(() => {
    // Create trail dots
    const dots = [];
    const positions = [];

    for (let i = 0; i < dotCount; i++) {
      const dot = document.createElement("div");
      dot.className = "cursor-trail-dot";
      dot.style.position = "fixed";
      dot.style.borderRadius = "50%";
      dot.style.pointerEvents = "none";
      dot.style.zIndex = "9999";
      dot.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      dot.style.transform = "translateZ(0)";
      dot.style.willChange = "transform, opacity, background-color";
      document.body.appendChild(dot);
      dots.push(dot);
      positions.push({ x: 0, y: 0 });
    }

    trailRef.current = dots;
    positionsRef.current = positions;

    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      
      // Update first position
      if (positionsRef.current[0]) {
        positionsRef.current[0].x = mouseX;
        positionsRef.current[0].y = mouseY;
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
        
        if (positionsRef.current[0]) {
          positionsRef.current[0].x = mouseX;
          positionsRef.current[0].y = mouseY;
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove);

    // Start animation
    animationFrameRef.current = requestAnimationFrame(updateTrail);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Clean up dots
      dots.forEach(dot => {
        if (dot.parentNode === document.body) {
          document.body.removeChild(dot);
        }
      });
    };
  }, [updateTrail]);

  return null; // This component doesn't render anything visible
};

const MainLayout = ({
  children,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
}) => {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Fixed Left Sidebar */}
      <LeftSidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 ml-48">
        {/* Top Navbar */}
        <nav className="fixed top-0 left-48 right-0 z-50 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1 max-w-xl">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search for friends, groups, pages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all duration-300 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Link to="/create-post" className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full font-medium hover:from-orange-600 hover:to-orange-700 transition-all duration-300 flex items-center space-x-2 shadow-sm">
                  <span className="text-lg">+</span>
                  <span>Add New Post</span>
                </Link>
                
                <ThemeToggle />
                
                <Link to="/notifications" className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-300">
                  <svg className="w-6 h-6 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Page Content */}
        <main className="pt-24 pb-8 px-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};

const App = () => {
  const [likedPosts, setLikedPosts] = useState({});
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Home");
  const [cursorTrailEnabled, setCursorTrailEnabled] = useState(true);

  // Initialize Web Vitals monitoring
  useWebVitals(reportWebVitals);

  useEffect(() => {
    // Mark app initialization
    performanceMonitor.mark("app-init");

    // Register Service Worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/serviceWorker.js")
        .then((registration) => {
          console.log("[SW] Registered:", registration);
        })
        .catch((error) => {
          console.error("[SW] Registration failed:", error);
        });
    }

    // Load cursor trail preference from localStorage
    const savedPreference = localStorage.getItem("cursorTrailEnabled");
    if (savedPreference !== null) {
      setCursorTrailEnabled(JSON.parse(savedPreference));
    }

    // Measure app load time
    window.addEventListener("load", () => {
      performanceMonitor.mark("app-loaded");
      performanceMonitor.measure("app-load-time", "app-init", "app-loaded");
      performanceMonitor.report();
    });
  }, []);

  useEffect(() => {
    // Save cursor trail preference to localStorage
    localStorage.setItem("cursorTrailEnabled", JSON.stringify(cursorTrailEnabled));
  }, [cursorTrailEnabled]);

  const stories = [
    {
      id: 1,
      username: "user1",
      avatar: "https://placehold.co/100x100/FF6B6B/FFFFFF?text=U1",
    },
    {
      id: 2,
      username: "user2",
      avatar: "https://placehold.co/100x100/4ECDC4/FFFFFF?text=U2",
    },
    {
      id: 3,
      username: "user3",
      avatar: "https://placehold.co/100x100/45B7D1/FFFFFF?text=U3",
    },
    {
      id: 4,
      username: "user4",
      avatar: "https://placehold.co/100x100/96CEB4/FFFFFF?text=U4",
    },
    {
      id: 5,
      username: "user5",
      avatar: "https://placehold.co/100x100/FFEAA7/FFFFFF?text=U5",
    },
    {
      id: 6,
      username: "user6",
      avatar: "https://placehold.co/100x100/DDA0DD/FFFFFF?text=U6",
    },
    {
      id: 7,
      username: "user7",
      avatar: "https://placehold.co/100x100/FFB3BA/FFFFFF?text=U7",
    },
  ];

  const posts = [
    {
      id: 1,
      user: {
        username: "traveler_adventures",
        avatar: "https://placehold.co/40x40/FF6B6B/FFFFFF?text=TA",
      },
      media:
        "https://placehold.co/500x600/4ECDC4/FFFFFF?text=Beautiful+Landscape",
      caption:
        "Exploring the hidden gems of nature 🌿 #wanderlust #naturephotography",
      likes: 245,
      comments: 18,
    },
    {
      id: 2,
      user: {
        username: "foodie_delights",
        avatar: "https://placehold.co/40x40/45B7D1/FFFFFF?text=FD",
      },
      media: "https://placehold.co/500x600/FFEAA7/FFFFFF?text=Delicious+Food",
      caption:
        "Just tried the best pasta in town! 🍝 Tag someone who needs to try this! #foodie #pasta",
      likes: 892,
      comments: 43,
    },
    {
      id: 3,
      user: {
        username: "fitness_motivation",
        avatar: "https://placehold.co/40x40/96CEB4/FFFFFF?text=FM",
      },
      media: "https://placehold.co/500x600/DDA0DD/FFFFFF?text=Workout+Session",
      caption:
        "Consistency is key 💪 Day 45 of my fitness journey! #fitness #gymmotivation",
      likes: 1567,
      comments: 89,
    },
  ];

  const suggestedAccounts = [
    {
      username: "tech_guru",
      avatar: "https://placehold.co/32x32/FF6B6B/FFFFFF?text=TG",
      followers: "1.2M",
    },
  ];

  const trendingHashtags = ["#photography", "#travel", "#fashion"];
  const onlineFriends = [];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStoryIndex((prev) => (prev + 1) % stories.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [stories.length]);

  const toggleLike = (postId) => {
    setLikedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const toggleCursorTrail = () => {
    setCursorTrailEnabled(!cursorTrailEnabled);
  };

  return (
    <ErrorProvider>
      <ErrorBoundary>
        <NotificationProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              iconTheme: { primary: "#EF4444", secondary: "#fff" },
            }}
          />
        

        <BackButton />

        {/* Cursor Trail Toggle Button */}
        <button
          onClick={toggleCursorTrail}
          className="fixed bottom-20 right-6 z-50 p-3 bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-2"
          aria-label={`${cursorTrailEnabled ? 'Disable' : 'Enable'} cursor trail effect`}
          title={`${cursorTrailEnabled ? 'Disable' : 'Enable'} cursor trail`}
        >
          {cursorTrailEnabled ? (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Render Cursor Trail if enabled */}
        {cursorTrailEnabled && <CursorTrail />}

        <Routes>
          <Route
            path="/"
            element={
              <Suspense fallback={<PostSkeleton />}>
                <Landing />
              </Suspense>
            }
          />
          <Route
            path="/login"
            element={
              <Suspense fallback={<PostSkeleton />}>
                <Login />
              </Suspense>
            }
          />
          <Route
            path="/signup"
            element={
              <Suspense fallback={<PostSkeleton />}>
                <Signup />
              </Suspense>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <Suspense fallback={<PostSkeleton />}>
                <ForgotPassword />
              </Suspense>
            }
          />
          <Route
            path="/learning"
            element={
              <Suspense fallback={<PostSkeleton />}>
                <LearningMode />
              </Suspense>
            }
          />

          <Route
            path="/home/*"
            element={
              <MainLayout
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              >
                <Suspense fallback={<PostSkeleton />}>
                  <Routes>
                    <Route
                      path="/"
                      element={
                        <Home
                          likedPosts={likedPosts}
                          toggleLike={toggleLike}
                          currentStoryIndex={currentStoryIndex}
                          setCurrentStoryIndex={setCurrentStoryIndex}
                          stories={stories}
                          posts={posts}
                          suggestedAccounts={suggestedAccounts}
                          trendingHashtags={trendingHashtags}
                          onlineFriends={onlineFriends}
                        />
                      }
                    />
                    <Route path="/reels" element={<Reels />} />
                    <Route path="/create-post" element={<CreatePost />} />
                    <Route path="/contact" element={<ContactUs />} />
                    <Route path="/certificate" element={<CertificatePage />} />
                    <Route
                      path="/assessment"
                      element={<GamifiedAssessmentPage />}
                    />
                    <Route path="/courses" element={<CoursesLanding />} />
                    <Route
                      path="/advanced-syllabus"
                      element={<AdvancedSyllabusPage />}
                    />
                    <Route
                      path="/study-room"
                      element={<StudyRoomPage />}
                    />
                  </Routes>
                </Suspense>
              </MainLayout>
            }
          />
        </Routes>

          {/* PWA Components */}
          <InstallPWA />
          <OfflineIndicator />

          <style>{`
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
            .scrollbar-hide {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
            .border-gradient-to-r {
              background: linear-gradient(to right, #ec4899, #8b5cf6, #f97316);
              border: 2px solid transparent;
              background-clip: padding-box, border-box;
              background-origin: padding-box, border-box;
            }
            
            /* Cursor Trail Styles */
            .cursor-trail-dot {
              filter: blur(0.5px);
              mix-blend-mode: screen;
            }
            
            /* Reduce trail on mobile/touch devices */
            @media (hover: none) and (pointer: coarse) {
              .cursor-trail-dot {
                display: none;
              }
            }
            
            /* Performance optimization */
            .cursor-trail-dot {
              contain: layout style paint;
            }
            
            /* PWA Animation */
            @keyframes slide-down {
              from {
                transform: translate(-50%, -100%);
                opacity: 0;
              }
            }
            .animate-slide-down {
              animation: slide-down 0.3s ease-out;
            }
            
            /* Reduce motion preference */
            @media (prefers-reduced-motion: reduce) {
              .cursor-trail-dot {
                transition: none !important;
                animation: none !important;
              }
            }
          `}</style>
        </NotificationProvider>
      </ErrorBoundary>
    </ErrorProvider>
  );
};

export default App;
