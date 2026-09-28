import { useState } from 'react';
import PinPad from '../components/PinPad';
import Sheet from '../components/Sheet';
import { useT } from '../i18n';
import { hashPin, isValidPin, verifyPin } from '../lib/pin';
import { useStore } from '../store';
import { Card } from './SettingsScreen';

type Mode = 'set' | 'change' | 'remove';

export default function PinSettings() {
  const { settings } = useStore();
  const [mode, setMode] = useState<Mode | null>(null);
  const on = !!settings.pinHash;
  const { t } = useT();
  const btn = 'btn';
  return (
    <Card title={t('pin.title')} id="set-pin">
      <p className="mb-3 text-sm text-muted">
        {t(on ? 'pin.on' : 'pin.off')} {t('pin.note')}
      </p>
      <div className="flex flex-wrap gap-2">
        {on ? (
          <>
            <button type="button" className={btn} onClick={() => setMode('change')}>{t('pin.change')}</button>
            <button type="button" className={btn} onClick={() => setMode('remove')}>{t('pin.turnOff')}</button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setMode('set')}>{t('pin.set')}</button>
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
  const { t } = useT();

  const submit = async () => {
    setMsg('');
    if (step === 'current') {
      if (!(await verifyPin(value, settings.pinHash!, settings.pinSalt!))) {
        setValue('');
        return setMsg(t('pin.noMatch'));
      }
      if (mode === 'remove') {
        await updateSettings({ pinHash: undefined, pinSalt: undefined });
        return onClose();
      }
      setValue('');
      return setStep('new');
    }
    if (step === 'new') {
      if (!isValidPin(value)) return setMsg(t('pin.digits'));
      setFirst(value);
      setValue('');
      return setStep('confirm');
    }
    if (value !== first) {
      setValue('');
      setFirst('');
      setStep('new');
      return setMsg(t('pin.mismatch'));
    }
    const { hash, salt } = await hashPin(value);
    await updateSettings({ pinHash: hash, pinSalt: salt });
    onClose();
  };

  const label = t(step === 'current' ? 'pin.current' : step === 'new' ? 'pin.new' : 'pin.again');
  return (
    <Sheet title={t(mode === 'remove' ? 'pin.turnOffTitle' : mode === 'change' ? 'pin.change' : 'pin.set')} onClose={onClose}>
      <PinPad key={step} value={value} onChange={setValue} onSubmit={submit} label={label} />
      <p role="alert" className="mt-3 min-h-6 text-center text-warn">{msg}</p>
    </Sheet>
  );
}
