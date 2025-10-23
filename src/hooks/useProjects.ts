import { useState, useEffect } from 'react';
import { Project } from '../types';
import { storageUtils } from '../utils/storage';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedProjects = storageUtils.getProjects();
    setProjects(savedProjects);
    setLoading(false);
  }, []);

  const addProject = (project: Omit<Project, 'id' | 'createdAt' | 'totalExpenses'>) => {
    const newProject: Project = {
      ...project,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      totalExpenses: 0,
    };
    
    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    storageUtils.saveProjects(updatedProjects);
    return newProject;
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    const updatedProjects = projects.map(project =>
      project.id === id ? { ...project, ...updates } : project
    );
    setProjects(updatedProjects);
    storageUtils.saveProjects(updatedProjects);
  };

  const deleteProject = (id: string) => {
    const updatedProjects = projects.filter(project => project.id !== id);
    setProjects(updatedProjects);
    storageUtils.saveProjects(updatedProjects);
  };

  const updateProjectExpenses = (projectId: string, totalExpenses: number) => {
    updateProject(projectId, { totalExpenses });
  };

  return {
    projects,
    loading,
    addProject,
    updateProject,
    deleteProject,
    updateProjectExpenses,
  };
};