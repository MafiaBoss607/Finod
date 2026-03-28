import { useRef } from 'react';
import { File, Folder, Link2, FileText, Upload, FolderUp, MessageSquare } from 'lucide-react';

type SidebarProps = {
  onImportFiles: (files: FileList) => void;
  onImportFolder: (files: FileList) => void;
};

export function Sidebar({ onImportFiles, onImportFolder }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleFileImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFolderImportClick = () => {
    folderInputRef.current?.click();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportFiles(e.target.files);
      e.target.value = ''; // reset so same files can be selected again
    }
  };

  const handleFolderSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportFolder(e.target.files);
      e.target.value = '';
    }
  };

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
    background: 'var(--accent-primary)', borderRadius: '8px', cursor: 'pointer',
    border: 'none', color: 'white', fontSize: '13px', fontWeight: 500,
    width: '100%', transition: 'background 0.2s',
  };

  const draggableStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
    background: 'var(--node-bg)', borderRadius: '8px', cursor: 'grab',
    border: '1px solid var(--node-border)',
  };

  return (
    <div 
      className="glass-panel" 
      style={{ 
        width: '240px', 
        height: 'calc(100vh - 40px)', 
        margin: '20px 0 20px 20px', 
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        zIndex: 10,
        position: 'absolute',
        top: 0,
        left: 0,
        overflowY: 'auto',
      }}
    >
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesSelected}
        multiple
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderSelected}
        /* @ts-expect-error webkitdirectory is not in React types */
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: 'none' }}
      />

      {/* Import Section */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Import
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Bring in your real files
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={handleFileImportClick}
            style={btnStyle}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'var(--accent-primary)'}
          >
            <Upload size={16} /> Import Files
          </button>
          <button
            onClick={handleFolderImportClick}
            style={{ ...btnStyle, background: 'var(--color-folder)' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#ca8a04'}
            onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-folder)'}
          >
            <FolderUp size={16} /> Import Folder
          </button>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--panel-border)' }} />

      {/* Draggable Nodes Section */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Nodes
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Drag to add to canvas
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div draggable onDragStart={(e) => onDragStart(e, 'file', 'New File')} style={draggableStyle}>
            <div style={{ color: 'var(--color-file)' }}><File size={20} /></div>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>File</span>
          </div>

          <div draggable onDragStart={(e) => onDragStart(e, 'folder', 'New Folder')} style={draggableStyle}>
            <div style={{ color: 'var(--color-folder)' }}><Folder size={20} /></div>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Folder</span>
          </div>

          <div draggable onDragStart={(e) => onDragStart(e, 'url', 'New Link')} style={draggableStyle}>
            <div style={{ color: 'var(--color-url)' }}><Link2 size={20} /></div>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>URL Link</span>
          </div>

          <div draggable onDragStart={(e) => onDragStart(e, 'page', 'New Page')} style={draggableStyle}>
            <div style={{ color: 'var(--color-page)' }}><FileText size={20} /></div>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Page Fragment</span>
          </div>

          <div draggable onDragStart={(e) => onDragStart(e, 'comment', 'New Comment')} style={draggableStyle}>
            <div style={{ color: 'var(--color-comment)' }}><MessageSquare size={20} /></div>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Comment</span>
          </div>
        </div>
      </div>
    </div>
  );
}
