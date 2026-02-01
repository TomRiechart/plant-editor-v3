import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import PlantEditor from '@/components/editor/PlantEditor';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Routes>
        <Route path="/" element={<PlantEditor />} />
      </Routes>
      <Toaster />
    </div>
  );
}

export default App;
