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
      className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={onClose} // Close modal on overlay click.
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-surface rounded-xl shadow-2xl w-full ${SIZES[size]} border border-border flex flex-col max-h-[90vh] animate-fade-in`}
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the modal content.
      >
        <div className="flex justify-between items-center h-14 px-5 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold truncate">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-icon">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
