import { useEditorStore } from '@/stores/editorStore';
import Sidebar from './Sidebar';
import DrawingCanvas from './DrawingCanvas';
import DrawingToolbar from './DrawingToolbar';

export default function EditorWorkspace() {
  const { selectedCollectionGroup } = useEditorStore();

  if (!selectedCollectionGroup) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No collection selected</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar with plants */}
      <Sidebar />

      {/* Main canvas area */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <DrawingCanvas />
        </div>

        {/* Toolbar */}
        <DrawingToolbar />
      </div>
    </div>
  );
}
