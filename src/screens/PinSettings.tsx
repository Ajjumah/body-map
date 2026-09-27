import { useState } from 'react';
import PinPad from '../components/PinPad';
import Sheet from '../components/Sheet';
import { hashPin, isValidPin, verifyPin } from '../lib/pin';
import { useStore } from '../store';
import { Card } from './SettingsScreen';

type Mode = 'set' | 'change' | 'remove';

export default function PinSettings() {
  const { settings } = useStore();
  const [mode, setMode] = useState<Mode | null>(null);
  const on = !!settings.pinHash;
  const btn = 'btn';
  return (
    <Card title="App lock" id="set-pin">
      <p className="mb-3 text-sm text-muted">
        {on ? 'On. You’ll be asked for your PIN when you open the app or come back to it after a minute away.' : 'Off. Add a 4–6 digit PIN to keep casual eyes out.'}{' '}
        The PIN is stored hashed on this device. It locks the screen; it doesn’t encrypt the data.
      </p>
      <div className="flex flex-wrap gap-2">
        {on ? (
          <>
            <button type="button" className={btn} onClick={() => setMode('change')}>Change PIN</button>
            <button type="button" className={btn} onClick={() => setMode('remove')}>Turn off</button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setMode('set')}>Set a PIN</button>
        )}
      </div>
      {mode && <PinFlow mode={mode} onClose={() => setMode(null)} />}
    </Card>
  );
}

function PinFlow({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const { settings, updateSettings } = useStore();
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>(mode === 'set' ? 'new' : 'current');
  const [value, setValue] = useState('');
  const [first, setFirst] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async () => {
    setMsg('');
    if (step === 'current') {
      if (!(await verifyPin(value, settings.pinHash!, settings.pinSalt!))) {
        setValue('');
        return setMsg('That PIN didn’t match.');
      }
      if (mode === 'remove') {
        await updateSettings({ pinHash: undefined, pinSalt: undefined });
        return onClose();
      }
      setValue('');
      return setStep('new');
    }
    if (step === 'new') {
      if (!isValidPin(value)) return setMsg('Use 4 to 6 digits.');
      setFirst(value);
      setValue('');
      return setStep('confirm');
    }
    if (value !== first) {
      setValue('');
      setFirst('');
      setStep('new');
      return setMsg('Those didn’t match. Let’s try again.');
    }
    const { hash, salt } = await hashPin(value);
    await updateSettings({ pinHash: hash, pinSalt: salt });
    onClose();
  };

  const label = step === 'current' ? 'Current PIN' : step === 'new' ? 'New PIN (4–6 digits)' : 'Enter the new PIN again';
  return (
    <Sheet title={mode === 'remove' ? 'Turn off app lock' : mode === 'change' ? 'Change PIN' : 'Set a PIN'} onClose={onClose}>
      <PinPad key={step} value={value} onChange={setValue} onSubmit={submit} label={label} />
      <p role="alert" className="mt-3 min-h-6 text-center text-warn">{msg}</p>
    </Sheet>
  );
}
