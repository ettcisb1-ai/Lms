import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Video, Search, Filter, MoreVertical, Globe2, EyeOff } from 'lucide-react';
import CourseFormPanel from '../../components/CourseFormPanel/CourseFormPanel';
import './Courses.css';
import { COURSE_ENDPOINTS } from '../../utils/api';
import { ShimmerAdminCourses } from '../../components/Shimmer/Shimmer';

const getRandomColorBg = (id) => {
  const colors = ['bg-blue', 'bg-purple', 'bg-pink', 'bg-green'];
  let hash = 0;
  if (id) {
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
  }
  return colors[Math.abs(hash) % colors.length];
};

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCourses = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(COURSE_ENDPOINTS.LIST);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to fetch courses.');
      if (result.success) {
        const mappedCourses = result.data.map(c => ({
          id: c._id,
          title: c.title,
          description: c.description || '',
          thumbnail: c.thumbnail || '',
          category: c.category ? (c.category.name || c.category) : 'Uncategorized',
          categoryId: c.category ? (c.category._id || c.category) : '',
          videos: c.videosCount || 0,
          students: c.studentsCount || 0,
          image: c.thumbnail ? '' : getRandomColorBg(c._id),
          status: c.status || 'Draft',
          difficulty: c.difficulty || 'Beginner',
          price: c.price || 'Free',
          instructor: c.instructor || 'Unknown'
        }));
        setCourses(mappedCourses);
      }
    } catch (err) {
      console.error('Fetch courses error:', err);
      setError(err.message || 'Failed to load courses.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchCourses(); }, []);

  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleDropdown = (e, id) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === id ? null : id);
  };

  const handleAction = async (e, action, course) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setActiveDropdown(null);
    const token = localStorage.getItem('lms_token');

    if (action === 'Edit') {
      setEditingCourse({ ...course, category: course.categoryId });
      setIsFormOpen(true);
    } else if (action === 'Create') {
      setEditingCourse(null);
      setIsFormOpen(true);
    } else if (action === 'Delete') {
      if (!window.confirm(`Delete course "${course.title}"?`)) return;
      try {
        const res = await fetch(COURSE_ENDPOINTS.DELETE(course.id), {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'Failed to delete course.');
        if (result.success) await fetchCourses();
      } catch (err) {
        alert(err.message || 'Failed to delete course.');
      }
    } else if (['Publish', 'Unpublish'].includes(action)) {
      const status = action === 'Publish' ? 'Published' : 'Draft';
      try {
        const res = await fetch(COURSE_ENDPOINTS.UPDATE(course.id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ status })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || `Failed to update status.`);
        if (result.success) await fetchCourses();
      } catch (err) {
        alert(err.message || `Failed to update status.`);
      }
    }
  };

  const handleSave = async (formData) => {
    const token = localStorage.getItem('lms_token');
    setIsSaving(true);
    try {
      const url = editingCourse ? COURSE_ENDPOINTS.UPDATE(editingCourse.id) : COURSE_ENDPOINTS.CREATE;
      const method = editingCourse ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          difficulty: formData.difficulty,
          instructor: formData.instructor,
          price: formData.price,
          status: formData.status
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to save course.');
      if (result.success) { await fetchCourses(); closeForm(); }
    } catch (err) {
      alert(err.message || 'Failed to save course.');
    } finally {
      setIsSaving(false);
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setTimeout(() => setEditingCourse(null), 300);
  };

  const filteredCourses = courses.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="courses-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Course Management</h2>
          <p className="page-subtitle">Create and manage courses, categories, and video lectures.</p>
        </div>
        <button className="btn-primary" onClick={(e) => handleAction(e, 'Create', null)}>
          <Plus size={16} />
          <span>Create New Course</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="courses-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {/* <button className="btn-secondary">
          <Filter size={16} />
          <span>Filter</span>
        </button> */}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#dc2626', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Table Card */}
      <div className="courses-table-card">
        {isLoading ? (
          <ShimmerAdminCourses count={6} />
        ) : filteredCourses.length === 0 ? (
          <div className="courses-empty">
            <Video size={40} style={{ opacity: 0.25, color: '#94a3b8' }} />
            <p>No courses found. Click "Create New Course" to get started.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="courses-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Instructor</th>
                  <th>Difficulty</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Content</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map(course => (
                  <tr key={course.id}>
                    {/* Course cell */}
                    <td>
                      <div className="course-cell">
                        <div className={`course-thumb ${course.image}`} style={course.thumbnail ? { background: '#f1f5f9' } : {}}>
                          {course.thumbnail
                            ? <img src={course.thumbnail} alt={course.title} className="course-thumb-img" />
                            : <Video size={16} style={{ opacity: 0.7, color: 'white' }} />}
                        </div>
                        <div>
                          <div className="course-cell-title">{course.title}</div>
                          <div className="course-cell-cat">{course.category}</div>
                        </div>
                      </div>
                    </td>

                    {/* Instructor */}
                    <td><span className="cell-text">{course.instructor}</span></td>

                    {/* Difficulty */}
                    <td>
                      <span className={`difficulty-badge ${course.difficulty.toLowerCase()}`}>
                        {course.difficulty}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`status-pill ${course.status.toLowerCase()}`}>
                        {course.status}
                      </span>
                    </td>

                    {/* Price */}
                    <td>
                      <span className={`price-pill ${course.price.toLowerCase()}`}>
                        {course.price}
                      </span>
                    </td>

                    {/* Content stats */}
                    <td>
                      <div className="content-stats">
                        <span>{course.videos} Lectures</span>
                        <span className="stat-dot">·</span>
                        <span>{course.students} Students</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="text-right">
                      <div className="action-cell">
                        <div className="dropdown-container">
                          <button className="icon-btn more" onClick={(e) => toggleDropdown(e, course.id)}>
                            <MoreVertical size={16} />
                          </button>
                          {activeDropdown === course.id && (
                            <div className="dropdown-menu">
                              <button onClick={(e) => handleAction(e, 'Edit', course)}><Edit2 size={14} /> Edit</button>
                              {course.status === 'Published' ? (
                                <button onClick={(e) => handleAction(e, 'Unpublish', course)}><EyeOff size={14} /> Unpublish</button>
                              ) : (
                                <button onClick={(e) => handleAction(e, 'Publish', course)}><Globe2 size={14} /> Publish</button>
                              )}
                              <button onClick={(e) => handleAction(e, 'Delete', course)} className="text-danger">
                                <Trash2 size={14} /> Delete Course
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CourseFormPanel
        course={editingCourse}
        isOpen={isFormOpen}
        onClose={closeForm}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </div>
  );
};

export default Courses;
