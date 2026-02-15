export default function ToggleSwitch({ enabled = false }) {
  return (
    <button className={`relative h-6 w-11 rounded-full transition ${enabled ? 'bg-primary' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}
