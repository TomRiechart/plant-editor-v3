import { useEditorStore } from '@/stores/editorStore';
import CollectionSelector from './CollectionSelector';
import EditorWorkspace from './EditorWorkspace';
import ResultsModal from './ResultsModal';
import SettingsModal from './SettingsModal';
import { Button } from '@/components/ui/button';
import { Settings, ArrowLeft } from 'lucide-react';
import { useState } from 'react';

export default function PlantEditor() {
  const { editorStep, selectedCollectionGroup, setEditorStep } = useEditorStore();
  const [showSettings, setShowSettings] = useState(false);

  const handleBack = () => {
    if (editorStep === 'editing') {
      setEditorStep('collection-select');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 border-b bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {editorStep === 'editing' && (
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-lg font-semibold">
            {editorStep === 'editing' && selectedCollectionGroup
              ? selectedCollectionGroup.name
              : 'Plant Collection Editor'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {editorStep === 'collection-select' && <CollectionSelector />}
        {editorStep === 'editing' && <EditorWorkspace />}
      </main>

      {/* Modals */}
      <ResultsModal />
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
