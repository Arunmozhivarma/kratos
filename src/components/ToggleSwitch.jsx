export default function ToggleSwitch({ checked = false, onChange }) {
  return (
    <button onClick={() => onChange?.(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-primary' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}
