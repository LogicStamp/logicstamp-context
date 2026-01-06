import { ref } from 'vue';

interface ButtonProps {
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  children?: string;
}

export function Button(props: ButtonProps) {
  const isHovered = ref(false);

  const handleClick = () => {
    if (!props.disabled) {
      props.onClick();
    }
  };

  return () => (
    <button
      onClick={handleClick}
      disabled={props.disabled}
      onMouseEnter={() => (isHovered.value = true)}
      onMouseLeave={() => (isHovered.value = false)}
      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
        props.variant === 'primary'
          ? 'bg-blue-500 hover:bg-blue-600 text-white'
          : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
      } ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {props.children}
    </button>
  );
}

