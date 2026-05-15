import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TabBar from './components/TabBar';
import TodayScreen from './screens/TodayScreen';
import LibraryScreen from './screens/LibraryScreen';
import ProgressScreen from './screens/ProgressScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg text-white">
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
        <TabBar />
      </div>
    </BrowserRouter>
  );
}
