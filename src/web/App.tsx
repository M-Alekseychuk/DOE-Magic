/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { ProjectProvider } from './state/ProjectContext';
import { BrandingProvider } from './state/BrandingContext';
import Layout from './Layout';
import Dashboard from './pages/Dashboard';
import ProjectView from './pages/ProjectView';
import GuideView from './pages/GuideView';

export default function App() {
  return (
    <LanguageProvider>
      <BrandingProvider>
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
      </BrandingProvider>
    </LanguageProvider>
  );
}
