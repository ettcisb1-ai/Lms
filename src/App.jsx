import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
import ForgotPassword from './pages/ForgotPassword/ForgotPassword'
import AdminLayout from './components/AdminLayout/AdminLayout'
import Dashboard from './pages/Dashboard/Dashboard'
import Users from './pages/Users/Users'
import UserDetails from './pages/UserDetails/UserDetails'
import Courses from './pages/Courses/Courses'
import CourseBuilder from './pages/CourseBuilder/CourseBuilder'
import Categories from './pages/Categories/Categories'
import Videos from './pages/Videos/Videos'
import VideoSettings from './pages/VideoSettings/VideoSettings'
import Settings from './pages/Settings/Settings'
import Notifications from './pages/Notifications/Notifications'
import Subscriptions from './pages/Subscriptions/Subscriptions'
import Analytics from './pages/Analytics/Analytics'

import Progress from './pages/Progress/Progress'
// import Reports from './pages/Reports/Reports'

// Student Portal Imports
import UserLayout from './components/UserLayout/UserLayout'
import UserDashboard from './pages/UserDashboard/UserDashboard'

import UserCourses from './pages/UserCourses/UserCourses'
import UserCoursePlayer from './pages/UserCoursePlayer/UserCoursePlayer'
import UserSubscriptions from './pages/UserSubscriptions/UserSubscriptions'
import UserProfile from './pages/UserProfile/UserProfile'
import UserNotifications from './pages/UserNotifications/UserNotifications'

import './App.css'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Admin Portal Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<UserDetails />} />
          <Route path="courses" element={<Courses />} />
          <Route path="courses/:id" element={<CourseBuilder />} />
          <Route path="categories" element={<Categories />} />
          <Route path="videos" element={<Videos />} />
          <Route path="videos/:id" element={<VideoSettings />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="progress" element={<Progress />} />
          {/* <Route path="reports" element={<Reports />} /> */}
          <Route path="settings" element={<Settings />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* Registered Student Portal Routes */}
        <Route path="/dashboard" element={<UserLayout />}>
          <Route index element={<UserDashboard />} />
          <Route path="courses" element={<UserCourses />} />
          <Route path="courses/:id" element={<UserCoursePlayer />} />
          <Route path="subscriptions" element={<UserSubscriptions />} />
          <Route path="settings" element={<UserProfile />} />
          <Route path="notifications" element={<UserNotifications />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App