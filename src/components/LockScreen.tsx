import { useEffect, useState } from 'react';
import { verifyPin } from '../lib/pin';
import { useStore } from '../store';
import ConfirmDialog from './ConfirmDialog';
import PinPad from './PinPad';

const MAX_TRIES = 5;
const WAIT_SECS = 30;

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { settings, deleteAll } = useStore();
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [tries, setTries] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [forgot, setForgot] = useState(false);
  const waiting = waitUntil > now;

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  const submit = async () => {
    if (waiting || pin.length < 4) return;
    const ok = await verifyPin(pin, settings.pinHash!, settings.pinSalt!);
    if (ok) return onUnlock();
    const n = tries + 1;
    setTries(n);
    setPin('');
    if (n % MAX_TRIES === 0) {
      setWaitUntil(Date.now() + WAIT_SECS * 1000);
      setNow(Date.now());
      setMsg(`Let’s pause for ${WAIT_SECS} seconds before trying again.`);
    } else setMsg('That PIN didn’t match. Try again.');
  };

  return (
    <main className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-bg p-6">
      <div className="text-center">
        <h1 className="text-3xl text-ink">Body Map is resting</h1>
        <p className="text-muted">Enter your PIN to come in.</p>
      </div>
      <PinPad value={pin} onChange={setPin} onSubmit={submit} label="PIN" disabled={waiting} />
      <p role="alert" className="min-h-6 text-center text-warn">
        {waiting ? `Try again in ${Math.ceil((waitUntil - now) / 1000)}s.` : msg}
      </p>
      <button type="button" onClick={() => setForgot(true)} className="min-h-11 text-sm text-muted underline">Forgot PIN?</button>
      {forgot && (
        <ConfirmDialog
          title="Reset the app?"
          confirmLabel="Delete everything"
          typeToConfirm="DELETE"
          onCancel={() => setForgot(false)}
          onConfirm={async () => {
            await deleteAll();
            onUnlock();
          }}
        >
          Your PIN can’t be recovered, because nothing leaves this device. The only way in is to delete all data on this device and start fresh. If you have an exported backup, you can import it afterwards.
        </ConfirmDialog>
      )}
    </main>
  );
}
