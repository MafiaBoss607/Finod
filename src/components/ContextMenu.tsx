import { Trash2, Unlink, Copy, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

type ContextMenuProps = {
  x: number;
  y: number;
  nodeId: string;
  nodeType: string;
  isExpanded?: boolean;
  onDelete: () => void;
  onDisconnectAll: () => void;
  onDuplicate: () => void;
  onToggleExpand?: () => void;
  onOpenFile?: () => void;
  onClose: () => void;
};

export function ContextMenu({
  x, y, nodeType, isExpanded,
  onDelete, onDisconnectAll, onDuplicate, onToggleExpand, onOpenFile, onClose,
}: ContextMenuProps) {
  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 14px', cursor: 'pointer', fontSize: '13px',
    color: 'var(--text-primary)', transition: 'background 0.15s',
    borderRadius: '6px', border: 'none', background: 'transparent',
    width: '100%', textAlign: 'left', fontFamily: 'inherit',
  };

  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
  };
  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'transparent';
  };

  return (
    <>
      {/* Invisible backdrop to close menu */}
      <div
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        className="glass-panel"
        style={{
          position: 'fixed',
          left: x,
          top: y,
          zIndex: 100,
          padding: '6px',
          minWidth: '180px',
          animation: 'contextMenuIn 0.12s ease-out',
        }}
      >
        {/* Open File — file & url nodes only */}
        {onOpenFile && (nodeType === 'file' || nodeType === 'url') && (
          <button style={itemStyle} onClick={onOpenFile} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
            <ExternalLink size={14} style={{ color: 'var(--color-file)' }} /> Open File
          </button>
        )}

        {/* Expand/Collapse — folders only */}
        {nodeType === 'folder' && onToggleExpand && (
          <button style={itemStyle} onClick={onToggleExpand} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
            {isExpanded
              ? <><ChevronDown size={14} style={{ color: 'var(--color-folder)' }} /> Collapse</>
              : <><ChevronRight size={14} style={{ color: 'var(--color-folder)' }} /> Expand</>
            }
          </button>
        )}

        <button style={itemStyle} onClick={onDuplicate} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
          <Copy size={14} style={{ color: 'var(--accent-primary)' }} /> Duplicate
        </button>

        <button style={itemStyle} onClick={onDisconnectAll} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
          <Unlink size={14} style={{ color: 'var(--color-url)' }} /> Disconnect All
        </button>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--panel-border)', margin: '4px 8px' }} />

        <button
          style={{ ...itemStyle, color: '#ef4444' }}
          onClick={onDelete}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </>
  );
}
