import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  apiCost: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  apiCost,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onCancel}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>{message}</p>
          <div className="api-cost-info">
            <strong>Estimated API Requests:</strong>
            <p style={{ whiteSpace: 'pre-line' }}>{apiCost}</p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onConfirm}>
            Confirm
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
