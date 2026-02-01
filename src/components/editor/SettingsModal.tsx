import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Unlock } from 'lucide-react';

const CORRECT_PIN = '6262';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const [formData, setFormData] = useState({
    system_prompt: '',
    implement_prompt_analyze: '',
    implement_prompt_generate: '',
    implement_prompt_apply: '',
  });

  // Load settings into form
  useEffect(() => {
    if (settings) {
      setFormData({
        system_prompt: settings.system_prompt || '',
        implement_prompt_analyze: settings.implement_prompt_analyze || '',
        implement_prompt_generate: settings.implement_prompt_generate || '',
        implement_prompt_apply: settings.implement_prompt_apply || '',
      });
    }
  }, [settings]);

  // Reset unlock state when modal closes
  useEffect(() => {
    if (!open) {
      setIsUnlocked(false);
      setPin('');
      setPinError(false);
    }
  }, [open]);

  const handlePinSubmit = () => {
    if (pin === CORRECT_PIN) {
      setIsUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
    }
  };

  const handleSave = async () => {
    await updateSettings.mutateAsync(formData);
    onOpenChange(false);
  };

  const handleChange = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isUnlocked ? (
              <>
                <Unlock className="h-5 w-5 text-green-600" />
                Settings (Unlocked)
              </>
            ) : (
              <>
                <Lock className="h-5 w-5" />
                Settings (Locked)
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {!isUnlocked ? (
          // PIN Entry
          <div className="py-8">
            <div className="max-w-xs mx-auto space-y-4">
              <Label htmlFor="pin">Enter PIN to unlock settings</Label>
              <Input
                id="pin"
                type="password"
                placeholder="••••"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setPinError(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                className={pinError ? 'border-destructive' : ''}
                maxLength={4}
              />
              {pinError && (
                <p className="text-sm text-destructive">Incorrect PIN. Try again.</p>
              )}
              <Button onClick={handlePinSubmit} className="w-full">
                Unlock
              </Button>
            </div>
          </div>
        ) : (
          // Settings Form
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* System Prompt */}
            <div className="space-y-2">
              <Label htmlFor="system-prompt">
                System Prompt (Generate Step)
              </Label>
              <p className="text-xs text-muted-foreground">
                Base instructions for Fal.ai when generating plant replacements
              </p>
              <Textarea
                id="system-prompt"
                value={formData.system_prompt}
                onChange={(e) => handleChange('system_prompt', e.target.value)}
                className="h-32 font-mono text-sm"
              />
            </div>

            {/* Analyze Prompt */}
            <div className="space-y-2">
              <Label htmlFor="analyze-prompt">
                Implement: Analyze Prompt (Step 1)
              </Label>
              <p className="text-xs text-muted-foreground">
                Instructions for Gemini to analyze differences between original and edited
              </p>
              <Textarea
                id="analyze-prompt"
                value={formData.implement_prompt_analyze}
                onChange={(e) => handleChange('implement_prompt_analyze', e.target.value)}
                className="h-32 font-mono text-sm"
              />
            </div>

            {/* Generate Prompt */}
            <div className="space-y-2">
              <Label htmlFor="generate-prompt">
                Implement: Generate Prompt (Step 2.5)
              </Label>
              <p className="text-xs text-muted-foreground">
                Template for Gemini to create custom prompts. Use {'{analysis}'} placeholder.
              </p>
              <Textarea
                id="generate-prompt"
                value={formData.implement_prompt_generate}
                onChange={(e) => handleChange('implement_prompt_generate', e.target.value)}
                className="h-32 font-mono text-sm"
              />
            </div>

            {/* Apply Prompt */}
            <div className="space-y-2">
              <Label htmlFor="apply-prompt">
                Implement: Apply Prompt (Step 3)
              </Label>
              <p className="text-xs text-muted-foreground">
                Template for Fal.ai final generation. Use {'{customPrompt}'} placeholder.
              </p>
              <Textarea
                id="apply-prompt"
                value={formData.implement_prompt_apply}
                onChange={(e) => handleChange('implement_prompt_apply', e.target.value)}
                className="h-32 font-mono text-sm"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {isUnlocked && (
            <Button onClick={handleSave} disabled={updateSettings.isPending}>
              {updateSettings.isPending && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Save Settings
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
