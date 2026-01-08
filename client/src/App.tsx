import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { CampaignList } from './pages/CampaignList';
import { CampaignDetail } from './pages/CampaignDetail';
import { CampaignSetup } from './pages/CampaignSetup';
import { LiveSession } from './pages/LiveSession';
import { SessionDetail } from './pages/SessionDetail';
import { Landing } from './pages/Landing';

function App() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<Landing />} />
      
      {/* Protected routes */}
      <Route
        path="/app/*"
        element={
          <>
            <SignedIn>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/campaigns" element={<CampaignList />} />
                  <Route path="/campaigns/new" element={<CampaignSetup />} />
                  <Route path="/campaigns/:id" element={<CampaignDetail />} />
                  <Route path="/campaigns/:id/edit" element={<CampaignSetup />} />
                  <Route path="/campaigns/:campaignId/sessions/:sessionId" element={<SessionDetail />} />
                  <Route path="/campaigns/:campaignId/live" element={<LiveSession />} />
                  <Route path="/campaigns/:campaignId/live/:sessionId" element={<LiveSession />} />
                </Routes>
              </Layout>
            </SignedIn>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
          </>
        }
      />
      
      {/* Redirect old paths */}
      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

export default App;


