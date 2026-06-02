import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import AccountLookup from './pages/AccountLookup';
import TrackedItems from './pages/TrackedItems';
import TrackedAccounts from './pages/TrackedAccounts';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/accounts" element={<AccountLookup />} />
          <Route path="/accounts-directory" element={<TrackedAccounts />} />
          <Route path="/posts" element={<TrackedItems type="posts" />} />
          <Route path="/comments" element={<TrackedItems type="comments" />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
