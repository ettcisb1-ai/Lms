import React, { useState, useEffect } from 'react';
import { X, Save, Loader } from 'lucide-react';
import './CourseFormPanel.css';
import { CATEGORY_ENDPOINTS } from '../../utils/api';

const CourseFormPanel = ({ course, isOpen, onClose, onSave, isSaving }) => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(CATEGORY_ENDPOINTS.LIST);
        const result = await response.json();
        if (result.success) {
          setCategories(result.data);
        }
      } catch (err) {
        console.error('Error fetching categories in course form:', err);
      }
    };
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    difficulty: 'Beginner',
    instructor: '',
    price: 'Free',
    status: 'Draft'
  });

  useEffect(() => {
    if (course) {
      setFormData({
        title: course.title || '',
        description: course.description || '',
        category: course.category || '',
        difficulty: course.difficulty || 'Beginner',
        instructor: course.instructor || '',
        price: course.price || 'Free',
        status: course.status || 'Draft'
      });
    } else {
      setFormData({
        title: '',
        description: '',
        category: '',
        difficulty: 'Beginner',
        instructor: '',
        price: 'Free',
        status: 'Draft'
      });
    }
  }, [course, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <>
      <div className={`slide-over-backdrop ${isOpen ? 'open' : ''}`} onClick={isSaving ? undefined : onClose}></div>
      <div className={`slide-over-panel course-form-panel ${isOpen ? 'open' : ''}`}>
        <div className="panel-header">
          <div>
            <h3 className="panel-title">{course ? 'Edit Course' : 'Create New Course'}</h3>
            <p className="panel-subtitle">{course ? 'Update course metadata and settings' : 'Add a new course to your catalog'}</p>
          </div>
          <button className="icon-btn close-btn" onClick={onClose} disabled={isSaving}><X size={20} /></button>
        </div>

        <form className="panel-form" onSubmit={handleSubmit}>
          <div className="form-body">

            <div className="form-group">
              <label>Course Title</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="e.g. React Masterclass" required />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Briefly describe what students will learn..." rows={4}></textarea>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select name="category" value={formData.category} onChange={handleChange} required>
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Difficulty</label>
                <select name="difficulty" value={formData.difficulty} onChange={handleChange}>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Instructor Name</label>
                <input type="text" name="instructor" value={formData.instructor} onChange={handleChange} placeholder="Instructor's full name" />
              </div>

              <div className="form-group">
                <label>Price</label>
                <select name="price" value={formData.price} onChange={handleChange}>
                  <option value="Free">Free</option>
                  <option value="Premium">Premium</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

          </div>

          <div className="panel-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? <Loader size={16} className="spin-icon" /> : <Save size={16} />}
              <span>{isSaving ? (course ? 'Saving...' : 'Creating...') : (course ? 'Save Changes' : 'Create Course')}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default CourseFormPanel;
