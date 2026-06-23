import React, { useState, useEffect } from 'react';
import { X, Save, Loader } from 'lucide-react';
import './CategoryFormPanel.css';

const CategoryFormPanel = ({ category, isOpen, onClose, onSave, isSaving }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        description: category.description || ''
      });
    } else {
      setFormData({
        name: '',
        description: ''
      });
    }
  }, [category, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className={`category-slide-over-backdrop ${isOpen ? 'open' : ''}`} onClick={isSaving ? undefined : onClose}>
      <div className={`category-slide-over-panel ${isOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h2>{category ? 'Edit Category' : 'Create Category'}</h2>
            <p>{category ? 'Update category details' : 'Add a new category to your catalog'}</p>
          </div>
          <button className="icon-btn close-btn" onClick={onClose} disabled={isSaving}>
            <X size={20} />
          </button>
        </div>

        <div className="panel-body">
          <form id="categoryForm" onSubmit={handleSubmit}>
            <div className="form-section">
              <h3>Category Details</h3>
              
              <div className="form-group">
                <label>Category Name</label>
                <input 
                  type="text" 
                  name="name"
                  value={formData.name} 
                  onChange={handleChange}
                  placeholder="e.g. Web Development"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea 
                  name="description"
                  value={formData.description} 
                  onChange={handleChange}
                  rows="4" 
                  placeholder="Brief description of what this category covers..."
                ></textarea>
              </div>

            </div>
          </form>
        </div>

        <div className="panel-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" form="categoryForm" className="btn-primary" disabled={isSaving}>
            {isSaving ? <Loader size={16} className="spin-icon" /> : <Save size={16} />}
            <span>{isSaving ? (category ? 'Saving...' : 'Creating...') : (category ? 'Save Changes' : 'Create Category')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryFormPanel;
