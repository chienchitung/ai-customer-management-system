import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CloseIcon } from './icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'lg' }) => {
  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Render the modal using a portal to attach it to the body, ensuring it's on top of other content.
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose} // Close modal on overlay click.
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-surface rounded-lg shadow-xl w-full ${SIZES[size]} border border-border flex flex-col max-h-[90vh]`}
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the modal content.
      >
        <div className="flex justify-between items-center p-4 border-b border-border flex-shrink-0">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-full text-text-secondary hover:bg-secondary hover:text-text-primary transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
