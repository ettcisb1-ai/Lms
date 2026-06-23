import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Grid, Monitor, Smartphone, Cpu, Palette, ChevronRight, ChevronDown } from 'lucide-react';
import './Categories.css';
import CategoryFormPanel from '../../components/CategoryFormPanel/CategoryFormPanel';
import { CATEGORY_ENDPOINTS } from '../../utils/api';
import { ShimmerCategories } from '../../components/Shimmer/Shimmer';

const MOCK_CATEGORIES = [
  {
    id: 1,
    name: 'Web Development',
    slug: 'web-development',
    icon: 'Monitor',
    description: 'All courses related to building websites and web applications.',
    coursesCount: 24,
    children: [
      { id: 11, name: 'Frontend', slug: 'frontend', icon: 'Grid', description: 'React, Vue, HTML, CSS', coursesCount: 15, children: [] },
      { id: 12, name: 'Backend', slug: 'backend', icon: 'Cpu', description: 'Node.js, Python, Databases', coursesCount: 9, children: [] },
    ]
  },
  {
    id: 2,
    name: 'Mobile App Development',
    slug: 'mobile-development',
    icon: 'Smartphone',
    description: 'iOS, Android, and cross-platform app development.',
    coursesCount: 8,
    children: []
  },
  {
    id: 3,
    name: 'UI/UX Design',
    slug: 'ui-ux-design',
    icon: 'Palette',
    description: 'Design principles, Figma, Adobe XD, and user research.',
    coursesCount: 12,
    children: []
  }
];

const ICONS = {
  Grid: <Grid size={18} />,
  Monitor: <Monitor size={18} />,
  Smartphone: <Smartphone size={18} />,
  Cpu: <Cpu size={18} />,
  Palette: <Palette size={18} />
};

const CategoryRow = ({ category, level = 0, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = category.children && category.children.length > 0;

  return (
    <>
      <div className={`category-row level-${level}`}>
        <div className="cat-cell cat-name-cell" style={{ paddingLeft: `${level * 40 + 16}px` }}>
          {hasChildren ? (
            <button className="expand-btn" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <span className="expand-spacer"></span>
          )}
          <div className="cat-icon-wrapper">
            {ICONS[category.icon] || <Grid size={18} />}
          </div>
          <div className="cat-name-info">
            <span className="cat-name">{category.name}</span>
          </div>
        </div>
        <div className="cat-cell cat-desc">{category.description}</div>
        <div className="cat-cell cat-count">
          <span className="count-badge">{category.coursesCount} Courses</span>
        </div>
        <div className="cat-cell cat-actions">
          <button className="icon-btn edit" onClick={() => onEdit(category)}><Edit2 size={16} /></button>
          <button className="icon-btn delete" onClick={() => onDelete(category)}><Trash2 size={16} /></button>
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div className="category-children">
          {category.children.map(child => (
            <CategoryRow 
              key={child.id} 
              category={child} 
              level={level + 1} 
              onEdit={onEdit} 
              onDelete={onDelete} 
            />
          ))}
        </div>
      )}
    </>
  );
};

const buildHierarchicalTree = (flatList) => {
  const map = {};
  const roots = [];

  flatList.forEach(item => {
    map[item._id] = {
      id: item._id,
      name: item.name,
      icon: item.icon,
      description: item.description,
      coursesCount: item.coursesCount || 0,
      parent: item.parent ? (item.parent._id || item.parent) : 'none',
      children: []
    };
  });

  flatList.forEach(item => {
    const mapped = map[item._id];
    const parentId = item.parent ? (item.parent._id || item.parent) : null;
    
    if (parentId && map[parentId]) {
      map[parentId].children.push(mapped);
    } else {
      roots.push(mapped);
    }
  });

  return roots;
};

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [flatCategories, setFlatCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCategories = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(CATEGORY_ENDPOINTS.LIST);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to fetch categories.');
      if (result.success) {
        const mappedFlat = result.data.map(c => ({
          id: c._id,
          name: c.name,
          icon: c.icon,
          description: c.description,
          parent: c.parent ? (c.parent._id || c.parent) : 'none'
        }));
        setFlatCategories(mappedFlat);
        const hierarchical = buildHierarchicalTree(result.data);
        setCategories(hierarchical);
      }
    } catch (err) {
      console.error('Fetch categories error:', err);
      setError(err.message || 'Failed to load categories.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = () => {
    setEditingCategory(null);
    setIsFormOpen(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setIsFormOpen(true);
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`Are you sure you want to delete "${category.name}"?`)) return;
    const token = localStorage.getItem('lms_token');
    try {
      const response = await fetch(CATEGORY_ENDPOINTS.DELETE(category.id), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to delete category.');

      if (result.success) {
        await fetchCategories();
      }
    } catch (err) {
      console.error('Delete category error:', err);
      alert(err.message || 'Failed to delete category.');
    }
  };

  const handleSave = async (formData) => {
    const token = localStorage.getItem('lms_token');
    setIsSaving(true);
    try {
      const url = editingCategory 
        ? CATEGORY_ENDPOINTS.UPDATE(editingCategory.id) 
        : CATEGORY_ENDPOINTS.CREATE;
      const method = editingCategory ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to save category.');

      if (result.success) {
        await fetchCategories();
        setIsFormOpen(false);
      }
    } catch (err) {
      console.error('Save category error:', err);
      alert(err.message || 'Failed to save category.');
    } finally {
      setIsSaving(false);
    }
  };

  // Basic search: look in parent or child categories
  const filterCategories = (list, term) => {
    if (!term) return list;
    return list
      .map(cat => {
        const matchesName = cat.name.toLowerCase().includes(term.toLowerCase());
        const filteredChildren = cat.children ? filterCategories(cat.children, term) : [];
        
        if (matchesName || filteredChildren.length > 0) {
          return {
            ...cat,
            children: filteredChildren
          };
        }
        return null;
      })
      .filter(Boolean);
  };

  const filteredCategories = filterCategories(categories, searchTerm);

  return (
    <div className="categories-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Categories</h2>
          <p className="page-subtitle">Organize your courses into a hierarchical structure.</p>
        </div>
        <button className="btn-primary" onClick={handleCreate}>
          <Plus size={16} />
          <span>Create Category</span>
        </button>
      </div>

      <div className="categories-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search categories..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="categories-list-container">
        <div className="categories-list-header">
          <div className="cat-head" style={{flex: 2}}>Category</div>
          <div className="cat-head" style={{flex: 2}}>Description</div>
          <div className="cat-head" style={{flex: 1}}>Courses</div>
          <div className="cat-head text-right" style={{flex: '0 0 100px', textAlign: 'right'}}>Actions</div>
        </div>
        <div className="categories-list-body">
          {isLoading ? (
            <ShimmerCategories count={5} />
          ) : filteredCategories.length > 0 ? (
            filteredCategories.map(category => (
              <CategoryRow 
                key={category.id} 
                category={category} 
                onEdit={handleEdit} 
                onDelete={handleDelete} 
              />
            ))
          ) : (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No categories found.
            </div>
          )}
        </div>
      </div>

      <CategoryFormPanel 
        category={editingCategory}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        categories={flatCategories}
        isSaving={isSaving}
      />
    </div>
  );
};

export default Categories;
