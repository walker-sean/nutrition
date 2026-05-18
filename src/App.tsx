import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TabBar from './components/TabBar';
import TodayScreen from './screens/TodayScreen';
import LibraryLayout from './screens/library/LibraryLayout';
import FoodsSubScreen from './screens/library/FoodsSubScreen';
import RecipesSubScreen from './screens/library/RecipesSubScreen';
import ProgressScreen from './screens/ProgressScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg text-white">
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/library" element={<LibraryLayout />}>
            <Route index element={<FoodsSubScreen />} />
            <Route path="recipes" element={<RecipesSubScreen />} />
            <Route path="plans" element={<div className="text-sm text-subtle">Plans — added in Phase 2.</div>} />
          </Route>
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
        <TabBar />
      </div>
    </BrowserRouter>
  );
}
