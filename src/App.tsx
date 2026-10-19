/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { ProjectProvider } from './context/ProjectContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProjectView from './pages/ProjectView';
import GuideView from './pages/GuideView';

export default function App() {
  return (
    <LanguageProvider>
      <ProjectProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="project/:id" element={<ProjectView />} />
              <Route path="guide" element={<GuideView />} />
            </Route>
          </Routes>
        </HashRouter>
      </ProjectProvider>
    </LanguageProvider>
  );
}
