import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import AccountLookup from './pages/AccountLookup';
import TrackedItems from './pages/TrackedItems';
import TrackedAccounts from './pages/TrackedAccounts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30000,
      retry: 1
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}

export default App;
