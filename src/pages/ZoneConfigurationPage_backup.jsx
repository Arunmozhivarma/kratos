import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ZoneConfigurationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { labId, labName } = location.state || {};

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [zones, setZones] = useState({});
  const [currentFanId, setCurrentFanId] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currentConfigBox, setCurrentConfigBox] = useState(1); // Track which config box we're working on

  useEffect(() => {
    startCamera();
    loadExistingZones();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [labId]);

  const loadExistingZones = async () => {
    try {
      // Load existing zones for this specific lab
      const response = await fetch(`http://localhost:5000/api/zones?labId=${labId}`);
      if (response.ok) {
        const data = await response.json();
        setZones(data);
        console.log('Loaded existing zones for lab', labId, ':', data);
        if (Object.keys(data).length > 0) {
          setMessage(`Loaded ${Object.keys(data).length} existing zones for this lab`);
        }
      }
    } catch (err) {
      console.error('Error loading existing zones:', err);
      // Don't show error to user, just start fresh
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Failed to access camera. Please ensure camera permissions are granted.');
    }
  };

  const handleMouseDown = (e) => {
    if (isTyping || !currentFanId) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (1280 / rect.width);
    const y = (e.clientY - rect.top) * (720 / rect.height);
    
    setIsDrawing(true);
    setStartPoint({ x, y });
  };

  const handleMouseUp = (e) => {
    if (!isDrawing || !startPoint || !currentFanId) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const endX = (e.clientX - rect.left) * (1280 / rect.width);
    const endY = (e.clientY - rect.top) * (720 / rect.height);
    
    // Create unique zone key with config box
    const zoneKey = `configBox${currentConfigBox}_${currentFanId}`;
    
    setZones(prev => ({
      ...prev,
      [zoneKey]: [[startPoint.x, startPoint.y], [endX, endY]]
    }));
    
    setIsDrawing(false);
    setStartPoint(null);
    
    setMessage(`Zone ${zoneKey} created for ${currentFanId} in Config Box ${currentConfigBox}`);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !startPoint) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) * (1280 / rect.width);
    const currentY = (e.clientY - rect.top) * (720 / rect.height);
    
    // Canvas drawing will be handled in drawZones
  };

  const drawZones = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing zones with different colors for different config boxes
    Object.entries(zones).forEach(([zoneKey, zone]) => {
      const [[x1, y1], [x2, y2]] = zone;
      
      // Extract config box number from zoneKey
      const configBoxMatch = zoneKey.match(/configBox(\d+)/);
      const configBoxNumber = configBoxMatch ? parseInt(configBoxMatch[1]) : 1;
      
      // Different colors for different config boxes
      const colors = [
        { border: '#10b981', fill: 'rgba(16, 185, 129, 0.2)', text: '#059669' }, // Green
        { border: '#f59e0b', fill: 'rgba(245, 158, 11, 0.2)', text: '#d97706' }  // Orange
      ];
      const color = colors[(configBoxNumber - 1) % colors.length];
      
      ctx.strokeStyle = color.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      
      // Fill with transparent color
      ctx.fillStyle = color.fill;
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      
      // Draw zone label
      ctx.fillStyle = color.text;
      ctx.font = 'bold 12px Arial';
      ctx.fillText(zoneKey, x1 + 5, y1 - 5);
    });

    // Draw current drawing rectangle
    if (isDrawing && startPoint) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const currentX = (event.clientX - rect.left) * (1280 / rect.width);
      const currentY = (event.clientY - rect.top) * (720 / rect.height);
      
      const colors = [
        { border: '#10b981', fill: 'rgba(16, 185, 129, 0.2)' },
        { border: '#f59e0b', fill: 'rgba(245, 158, 11, 0.2)' }
      ];
      const color = colors[(currentConfigBox - 1) % colors.length];
      
      ctx.strokeStyle = color.border;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(startPoint.x, startPoint.y, currentX - startPoint.x, currentY - startPoint.y);
      ctx.setLineDash([]);
    }
  };

  const createDevice = async (fanId) => {
    try {
      const response = await fetch('http://localhost:5000/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: fanId })
      });

      if (!response.ok) {
        throw new Error('Failed to create device');
      }

      return true;
    } catch (err) {
      console.error('Error creating device:', err);
      return false;
    }
  };

  const handleKeyPress = async (e) => {
    if (e.key === 'Enter') {
      if (currentFanId) {
        await createDevice(currentFanId);
        setMessage(`Fan ID set to: ${currentFanId}`);
      }
      setIsTyping(false);
    } else if (e.key === 'Backspace') {
      setCurrentFanId(prev => prev.slice(0, -1));
    } else if (e.key >= '0' && e.key <= '9') {
      setCurrentFanId(prev => prev + e.key);
    }
  };

  const saveZones = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Save zones to database for this specific lab
      const response = await fetch('http://localhost:5000/api/zones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labId: labId,
          zones: zones
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save zones');
      }

      setMessage(`Zones saved successfully for lab "${labName}"! ${Object.keys(zones).length} zones configured.`);
      
      // Navigate back to lab selection after successful save
      setTimeout(() => {
        navigate('/lab-select');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuit = () => {
    navigate('/lab-select');
  };

  useEffect(() => {
    drawZones();
  }, [zones]);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-app-bg to-white dark:from-gray-900 dark:to-gray-800">
      <div className="w-full p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="card-surface mb-6 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-primary">Zone Configuration</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Lab: <span className="font-semibold">{labName}</span> (ID: {labId})
                </p>
              </div>
              <button
                onClick={handleQuit}
                className="rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Back to Labs
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="card-surface mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {error}
            </div>
          )}

          {message && (
            <div className="card-surface mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {message}
            </div>
          )}

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Camera/Canvas Area */}
            <div className="lg:col-span-3">
              <div className="card-surface p-6">
                <h2 className="text-xl font-semibold text-primary mb-4">Camera View</h2>
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-auto"
                    style={{ maxHeight: '600px' }}
                  />
                  <canvas
                    ref={canvasRef}
                    width={1280}
                    height={720}
                    className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    style={{ maxHeight: '600px' }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Click and drag to draw zones for each fan
                </p>
              </div>
            </div>

            {/* Controls Panel */}
            <div className="space-y-4">
              {/* Controls */}
              <div className="card-surface p-6">
                <h3 className="text-lg font-semibold text-primary mb-4">Controls</h3>
                
                {/* Config Box Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Configuration Box
                  </label>
                  <div className="flex gap-2">
                    {[1, 2].map(boxNum => (
                      <button
                        key={boxNum}
                        onClick={() => setCurrentConfigBox(boxNum)}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                          currentConfigBox === boxNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200'
                        }`}
                      >
                        Config Box {boxNum}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Each lab can have 2 different configuration boxes with unique coordinates
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => setIsTyping(true)}
                    disabled={isTyping}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isTyping ? 'Entering Fan ID...' : 'Set Fan ID'}
                  </button>
                  
                  <button
                    onClick={saveZones}
                    disabled={loading || Object.keys(zones).length === 0}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Zones'}
                  </button>
                  
                  <button
                    onClick={handleQuit}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Current Fan ID */}
              <div className="card-surface p-6">
                <h3 className="text-lg font-semibold text-primary mb-4">Current Fan ID</h3>
                {isTyping ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={currentFanId}
                      onChange={(e) => setCurrentFanId(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Enter fan ID..."
                      className="w-full rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-emerald-500 focus:ring-emerald-500"
                      autoFocus
                    />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Press Enter to confirm</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-600 dark:bg-gray-800">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {currentFanId || 'Not set'}
                    </span>
                  </div>
                )}
              </div>

              {/* Configured Zones */}
              <div className="card-surface p-6">
                <h3 className="text-lg font-semibold text-primary mb-4">Configured Zones for {labName}</h3>
                
                {/* Group zones by config boxes */}
                <div className="space-y-4">
                  {[1, 2].map(configBoxNum => {
                    const configBoxZones = Object.entries(zones).filter(([zoneKey]) => 
                      zoneKey.startsWith(`configBox${configBoxNum}_`)
                    );
                    
                    return (
                      <div key={configBoxNum} className="border rounded-xl p-4 dark:border-gray-600">
                        <h4 className="font-medium text-primary mb-3 flex items-center">
                          <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                            configBoxNum === 1 ? 'bg-emerald-500' : 'bg-orange-500'
                          }`} />
                          Configuration Box {configBoxNum}
                        </h4>
                        
                        {configBoxZones.length === 0 ? (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            No zones configured in this box yet
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {configBoxZones.map(([zoneKey]) => {
                              const parts = zoneKey.split('_');
                              const fanId = parts[parts.length - 1];
                              
                              return (
                                <div key={zoneKey} className={`rounded-lg border px-3 py-2 ${
                                  configBoxNum === 1 
                                    ? 'border-emerald-200 bg-emerald-50' 
                                    : 'border-orange-200 bg-orange-50'
                                }`}>
                                  <span className={`font-medium ${
                                    configBoxNum === 1 
                                      ? 'text-emerald-800 dark:text-emerald-200' 
                                      : 'text-orange-800 dark:text-orange-200'
                                  }`}>
                                    Fan {fanId} - {zoneKey}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {Object.keys(zones).length > 0 && (
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                    These zones are specific to "{labName}" and will be saved separately from other labs.
                    Each configuration box can have different coordinates for the same devices.
                  </p>
                )}
              </div>

              {/* Instructions */}
              <div className="card-surface p-6">
                <h3 className="text-lg font-semibold text-primary mb-4">Instructions</h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start">
                    <span className="font-medium text-primary mr-2">1.</span>
                    Select Configuration Box (1 or 2)
                  </li>
                  <li className="flex items-start">
                    <span className="font-medium text-primary mr-2">2.</span>
                    Click "Set Fan ID" to enter fan number
                  </li>
                  <li className="flex items-start">
                    <span className="font-medium text-primary mr-2">3.</span>
                    Draw rectangle on camera view for the zone
                  </li>
                  <li className="flex items-start">
                    <span className="font-medium text-primary mr-2">4.</span>
                    Repeat for each fan and config box
                  </li>
                  <li className="flex items-start">
                    <span className="font-medium text-primary mr-2">5.</span>
                    Click "Save Zones" when finished
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
