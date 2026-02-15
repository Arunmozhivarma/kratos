export default function ToggleSwitch({ checked = false, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!checked)}
      className={
        'toggle-track ' +
        (checked
          ? 'relative h-6 w-11 rounded-full border-2 border-emerald-500 bg-emerald-500 transition dark:border-emerald-500 dark:bg-emerald-500'
          : 'relative h-6 w-11 rounded-full border-2 border-gray-400 bg-gray-400 transition dark:border-gray-500 dark:bg-gray-600')
      }
    >
      <span
        className={
          checked
            ? 'absolute top-0.5 right-0.5 left-auto h-4 w-4 rounded-full border border-gray-200 bg-white shadow transition'
            : 'absolute top-0.5 left-0.5 right-auto h-4 w-4 rounded-full border border-gray-300 bg-white shadow transition dark:border-gray-500 dark:bg-gray-200'
        }
      />
    </button>
  );
}
