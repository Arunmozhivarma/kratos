import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSelectedLab, getSelectedLabId } from '../data/labs';

export default function CameraLivePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get lab info from location state or localStorage
  const labInfo = location.state || {};
  const labId = labInfo.labId || getSelectedLabId();
  const labName = labInfo.labName || getSelectedLab();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [zones, setZones] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detectionStatus, setDetectionStatus] = useState({});
  const [isDetectionRunning, setIsDetectionRunning] = useState(false);

  useEffect(() => {
    if (!labId) {
      navigate('/lab-select');
      return;
    }

    loadZones();
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      // Stop detection when leaving
      if (isDetectionRunning) {
        stopDetection();
      }
    };
  }, [labId]);

  const loadZones = async () => {
    try {
      setLoading(true);
      // Load zones from database for this specific lab
      const response = await fetch(`http://localhost:5000/api/zones?labId=${labId}`);
      if (response.ok) {
        const data = await response.json();
        setZones(data);
        console.log('Loaded zones for lab', labId, ':', data);
      } else {
        const errorData = await response.json();
        console.error('Failed to load zones:', errorData.message);
        setZones({});
      }
    } catch (err) {
      console.error('Error loading zones:', err);
      setZones({});
    } finally {
      setLoading(false);
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

  const drawZones = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw zones with different colors for different config boxes
    Object.entries(zones).forEach(([zoneKey, zone]) => {
      const [[x1, y1], [x2, y2]] = zone;
      const isActive = detectionStatus[zoneKey];

      // Extract config box number
      const configBoxMatch = zoneKey.match(/configBox(\d+)/);
      const configBoxNumber = configBoxMatch ? parseInt(configBoxMatch[1]) : 1;

      const colors = [
        { border: '#10b981', fill: 'rgba(16, 185, 129, 0.2)' },
        { border: '#f59e0b', fill: 'rgba(245, 158, 11, 0.2)' }
      ];
      const color = colors[(configBoxNumber - 1) % colors.length];

      ctx.strokeStyle = isActive ? '#00ff00' : color.border;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // Draw zone label
      ctx.fillStyle = isActive ? '#00ff00' : color.border;
      ctx.fillRect(x1, y1 - 25, 120, 20);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(`${zoneKey}: ${isActive ? 'ON' : 'OFF'}`, x1 + 2, y1 - 10);
    });
  };

  const startDetection = async () => {
    try {
      setIsDetectionRunning(true);
      setError('');

      // Start the Python detection script
      const response = await fetch('http://localhost:5000/api/start-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labId, zones })
      });

      if (response.ok) {
        // Start polling for detection status
        startStatusPolling();
      } else {
        const data = await response.json();
        setError(`Failed to start detection: ${data.message}`);
        setIsDetectionRunning(false);
      }
    } catch (err) {
      setError(`Error starting detection: ${err.message}`);
      setIsDetectionRunning(false);
    }
  };

  const stopDetection = async () => {
    try {
      setIsDetectionRunning(false);

      const response = await fetch('http://localhost:5000/api/stop-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        console.error('Failed to stop detection');
      }
    } catch (err) {
      console.error('Error stopping detection:', err);
    }
  };

  const startStatusPolling = () => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('http://localhost:5000/api/detection-status');
        if (response.ok) {
          const status = await response.json();
          setDetectionStatus(status);
          drawZones();
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    }, 1000); // Poll every second

    // Store interval ID for cleanup
    return () => clearInterval(pollInterval);
  };

  useEffect(() => {
    drawZones();
  }, [zones, detectionStatus]);

  const handleBackToLabs = () => {
    if (isDetectionRunning) {
      stopDetection();
    }
    navigate('/lab-select');
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-app-bg to-white dark:from-gray-900 dark:to-gray-800">
      <div className="w-full p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="card-surface mb-6 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-primary">Camera Live View</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Lab: <span className="font-semibold">{labName}</span> (ID: {labId})
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Detection Status:
                  <span className={`ml-2 font-semibold ${isDetectionRunning ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isDetectionRunning ? 'Running' : 'Stopped'}
                  </span>
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={isDetectionRunning ? stopDetection : startDetection}
                  className={`rounded-xl px-4 py-2 font-medium text-white transition ${isDetectionRunning
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                >
                  {isDetectionRunning ? 'Stop Detection' : 'Start Detection'}
                </button>
                <button
                  onClick={handleBackToLabs}
                  className="rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Back to Labs
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="card-surface mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {error}
            </div>
          )}

          {loading && (
            <div className="card-surface mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Loading camera and zones...
            </div>
          )}

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Camera/Canvas Area */}
            <div className="lg:col-span-3">
              <div className="card-surface p-6">
                <h2 className="text-xl font-semibold text-primary mb-4">Live Camera Feed</h2>
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
                    className="absolute top-0 left-0 w-full h-full"
                    style={{ maxHeight: '600px' }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {Object.keys(zones).length === 0
                    ? 'No zones configured. Configure zones first to see detection areas.'
                    : `Showing ${Object.keys(zones).length} configured zones`
                  }
                </p>
              </div>
            </div>

            {/* Status Panel */}
            <div className="space-y-6">
              {/* Detection Status */}
              <div className="card-surface p-6">
                <h3 className="text-lg font-semibold text-primary mb-4">Detection Status</h3>
                <div className="space-y-2">
                  {Object.keys(zones).length === 0 ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">No zones configured</p>
                  ) : (
                    Object.keys(zones).map(fanId => (
                      <div key={fanId} className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white">
                          Fan {fanId}
                        </span>
                        <div className={`w-3 h-3 rounded-full ${detectionStatus[fanId] ? 'bg-emerald-500' : 'bg-rose-500'
                          }`} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Zone Information */}
              <div className="card-surface p-6">
                <h3 className="text-lg font-semibold text-primary mb-4">Zone Information for {labName}</h3>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Total Zones:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {Object.keys(zones).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Zones:</span>
                    <span className="font-medium text-emerald-600">
                      {Object.values(detectionStatus).filter(Boolean).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Inactive Zones:</span>
                    <span className="font-medium text-rose-600">
                      {Object.values(detectionStatus).filter(v => !v).length}
                    </span>
                  </div>
                </div>
                {Object.keys(zones).length > 0 && (
                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Showing zones specifically configured for "{labName}"
                  </p>
                )}
              </div>

              {/* Instructions */}
              <div className="card-surface p-6">
                <h3 className="text-lg font-semibold text-primary mb-4">Instructions</h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start">
                    <span className="font-medium text-primary mr-2">•</span>
                    Click "Start Detection" to begin occupancy monitoring
                  </li>
                  <li className="flex items-start">
                    <span className="font-medium text-primary mr-2">•</span>
                    Green zones indicate detected occupancy
                  </li>
                  <li className="flex items-start">
                    <span className="font-medium text-primary mr-2">•</span>
                    Red zones indicate no occupancy detected
                  </li>
                  <li className="flex items-start">
                    <span className="font-medium text-primary mr-2">•</span>
                    Detection automatically controls connected fans
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
