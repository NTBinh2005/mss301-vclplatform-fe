import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { GuestOnly, RequireAdmin, RequireLearner } from './components/Shells';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import Today from './pages/Today';
import Journey from './pages/Journey';
import LessonPage from './pages/Lesson';
import Dictionary from './pages/Dictionary';
import RequestSign from './pages/RequestSign';
import Studio from './pages/Studio';
import Community from './pages/Community';
import MyPosts from './pages/MyPosts';
import Profile from './pages/Profile';
import People from './pages/People';
import AdminOverview from './pages/admin/Overview';
import AdminCategories from './pages/admin/Categories';
import AdminSigns from './pages/admin/Signs';
import AdminUsers from './pages/admin/Users';
import AdminPosts from './pages/admin/Posts';
import AdminReports from './pages/admin/Reports';
import AdminRequests from './pages/admin/Requests';

/* Flow (from signmentor): landing → login / register (OTP) / forgot password (OTP)
   → learner app, or the separate admin app for ADMIN accounts. */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      <Route element={<RequireLearner />}>
        <Route path="/today" element={<Today />} />
        <Route path="/learn" element={<Journey />} />
        <Route path="/lesson/:id" element={<LessonPage />} />
        <Route path="/dictionary" element={<Dictionary />} />
        <Route path="/request" element={<RequestSign />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/community" element={<Community />} />
        <Route path="/community/mine" element={<MyPosts />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/people/:id" element={<People />} />
        <Route path="/blogs/:id" element={<SharedPostLink />} />
      </Route>

      <Route path="/admin" element={<RequireAdmin />}>
        <Route index element={<AdminOverview />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="signs" element={<AdminSigns />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="posts" element={<AdminPosts />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="requests" element={<AdminRequests />} />
      </Route>

      <Route path="*" element={<NotFound standalone />} />
    </Routes>
  );
}

// Share links from social-service point at /blogs/{id}; the community page opens it.
function SharedPostLink() {
  const { id } = useParams();
  return <Navigate to={`/community?post=${id}`} replace />;
}
