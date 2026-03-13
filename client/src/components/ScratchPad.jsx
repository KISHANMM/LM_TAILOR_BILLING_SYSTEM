import React, { useRef, useState, useEffect } from 'react';
import { Pencil, Eraser, RotateCcw, Save, X } from 'lucide-react';

export default function ScratchPad({ onSave, onClose }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil'); // 'pencil' or 'eraser'
  const [color, setColor] = useState('#6A1E2E'); // Default maroon

  useEffect(() => {
    const canvas = canvasRef.current;
    // Set display size (css pixels).
    canvas.style.width = '100%';
    canvas.style.height = '400px';

    // Set actual size in memory (scaled to account for high DPI screens).
    const scale = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;

    const context = canvas.getContext('2d');
    context.scale(scale, scale);
    context.lineCap = 'round';
    context.strokeStyle = color;
    context.lineWidth = 3;
    contextRef.current = context;

    // Fill background with white
    context.fillStyle = 'white';
    context.fillRect(0, 0, rect.width, rect.height);
  }, []);

  useEffect(() => {
    if (contextRef.current) {
      if (tool === 'eraser') {
        contextRef.current.strokeStyle = 'white';
        contextRef.current.lineWidth = 15;
      } else {
        contextRef.current.strokeStyle = color;
        contextRef.current.lineWidth = 3;
      }
    }
  }, [tool, color]);

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = getCoordinates(nativeEvent);
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = getCoordinates(nativeEvent);
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();
  };

  const finishDrawing = () => {
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const getCoordinates = (event) => {
    if (event.touches) {
      const rect = canvasRef.current.getBoundingClientRect();
      const touch = event.touches[0];
      return {
        offsetX: touch.clientX - rect.left,
        offsetY: touch.clientY - rect.top
      };
    }
    return {
      offsetX: event.offsetX,
      offsetY: event.offsetY
    };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    context.fillStyle = 'white';
    context.fillRect(0, 0, rect.width, rect.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
    onSave(imageBase64);
    onClose();
  };

  return (
    <div className="scratch-pad-overlay">
      <div className="scratch-pad-container">
        <div className="scratch-pad-header">
          <h3 className="card-title">Backneck Scratch Pad</h3>
          <button onClick={onClose} className="btn-close"><X size={20} /></button>
        </div>

        <div className="scratch-pad-toolbar">
          <div className="tool-group">
            <button 
              className={`tool-btn ${tool === 'pencil' ? 'active' : ''}`}
              onClick={() => setTool('pencil')}
              title="Pencil"
            >
              <Pencil size={18} />
            </button>
            <button 
              className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
              onClick={() => setTool('eraser')}
              title="Eraser"
            >
              <Eraser size={18} />
            </button>
            <button 
              className="tool-btn"
              onClick={clearCanvas}
              title="Clear Canvas"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          <div className="color-group">
            {['#6A1E2E', '#000000', '#1565C0', '#2E7D32'].map(c => (
              <button
                key={c}
                className={`color-btn ${color === c && tool === 'pencil' ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => {
                  setColor(c);
                  setTool('pencil');
                }}
              />
            ))}
          </div>

          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} /> Save Pattern
          </button>
        </div>

        <div className="canvas-wrapper">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={finishDrawing}
            onMouseLeave={finishDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={finishDrawing}
            style={{ cursor: tool === 'pencil' ? 'crosshair' : 'default' }}
          />
        </div>
        
        <p className="scratch-pad-hint">Draw your backneck pattern here. Pro Tip: Use a stylus for better precision!</p>
      </div>

      <style>{`
        .scratch-pad-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 20px;
        }
        .scratch-pad-container {
          background: white;
          width: 100%;
          max-width: 800px;
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .scratch-pad-header {
          padding: 16px 24px;
          border-bottom: 1px solid var(--gray-light);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--ivory);
        }
        .scratch-pad-toolbar {
          padding: 12px 24px;
          display: flex;
          gap: 20px;
          align-items: center;
          border-bottom: 1px solid var(--gray-light);
          flex-wrap: wrap;
        }
        .tool-group {
          display: flex;
          gap: 8px;
          background: var(--gray-light);
          padding: 4px;
          border-radius: 8px;
        }
        .tool-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          color: var(--charcoal);
          transition: all 0.2s;
        }
        .tool-btn:hover {
          background: rgba(0,0,0,0.05);
        }
        .tool-btn.active {
          background: white;
          color: var(--maroon);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .color-group {
          display: flex;
          gap: 8px;
        }
        .color-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .color-btn:hover {
          transform: scale(1.1);
        }
        .color-btn.active {
          border-color: var(--gold);
          transform: scale(1.1);
        }
        .canvas-wrapper {
          padding: 24px;
          background: #f0f0f0;
          flex: 1;
        }
        canvas {
          background: white;
          border-radius: 8px;
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);
          touch-action: none;
        }
        .btn-close {
          background: transparent;
          border: none;
          color: var(--gray);
          cursor: pointer;
          padding: 4px;
          display: flex;
          transition: color 0.2s;
        }
        .btn-close:hover {
          color: var(--maroon);
        }
        .scratch-pad-hint {
          padding: 12px 24px;
          font-size: 12px;
          color: var(--gray);
          text-align: center;
          background: var(--ivory);
          margin: 0;
        }
      `}</style>
    </div>
  );
}
