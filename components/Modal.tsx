
import React from 'react';
import ReactDOM from 'react-dom';
import { CloseIcon } from './icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  // Don't render anything if the modal is not open.
  if (!isOpen) return null;

  // Render the modal using a portal to attach it to the body, ensuring it's on top of other content.
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose} // Close modal on overlay click.
    >
      <div
        className="bg-surface rounded-lg shadow-xl w-full max-w-3xl m-4 border border-border"
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the modal content.
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-secondary hover:text-text-primary transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body // The DOM node to which the portal will attach the modal.
  );
};

export default Modal;