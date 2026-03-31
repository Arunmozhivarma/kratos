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

  const pollIntervalRef = useRef(null);
  const liveImageRef = useRef(null);
  const frameLoopActiveRef = useRef(false);
  const hasFrameRef = useRef(false);
  const runningRef = useRef(false);
  const lastStatusRef = useRef('{}');
  const [zones, setZones] = useState({});
  const [loading, setLoading] = useState(true);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(null);
  const [error, setError] = useState('');
  const [detectionStatus, setDetectionStatus] = useState({});
  const [isDetectionRunning, setIsDetectionRunning] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    runningRef.current = isDetectionRunning;
  }, [isDetectionRunning]);

  useEffect(() => {
    if (!labId) {
      navigate('/lab-select');
      return;
    }

    loadZones();
    loadCameras();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      stopFrameLoop();

      if (runningRef.current) {
        stopDetection();
      }
    };
  }, [labId, navigate]);

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

  const loadCameras = async () => {
    try {
      setCameraLoading(true);
      const response = await fetch('http://localhost:5000/api/cameras');
      if (!response.ok) {
        throw new Error('Failed to get camera list');
      }

      const data = await response.json();
      const cameraList = Array.isArray(data.cameras) ? data.cameras : [];
      setCameras(cameraList);

      if (cameraList.length === 0) {
        setSelectedCameraIndex(null);
        setError('No camera detected. Please check camera connection and refresh.');
        return;
      }

      const preferredIndex = Number.isInteger(data.preferredIndex)
        ? data.preferredIndex
        : cameraList[0].index;
      setSelectedCameraIndex(preferredIndex);
      setError('');
    } catch (err) {
      console.error('Error loading cameras:', err);
      setCameras([]);
      setSelectedCameraIndex(null);
      setError('Unable to detect connected cameras.');
    } finally {
      setCameraLoading(false);
    }
  };

  const startDetection = async () => {
    if (selectedCameraIndex === null || selectedCameraIndex === undefined) {
      setError('Please select a valid camera before starting detection.');
      return;
    }

    try {
      setError('');

      // Start the Python detection script
      const response = await fetch('http://localhost:5000/api/start-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labId, zones, cameraIndex: selectedCameraIndex })
      });

      if (response.ok) {
        setIsDetectionRunning(true);
        startStatusPolling();
        startFrameLoop();
      } else {
        const data = await response.json();
        setError(`Failed to start detection: ${data.message}`);
      }
    } catch (err) {
      setError(`Error starting detection: ${err.message}`);
    }
  };

  const stopDetection = async () => {
    try {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      stopFrameLoop();
      setIsDetectionRunning(false);
      setDetectionStatus({});
      lastStatusRef.current = '{}';
      setError('');

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
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch('http://localhost:5000/api/detection-status');
        if (response.ok) {
          const status = await response.json();
          const serialized = JSON.stringify(status);
          if (serialized !== lastStatusRef.current) {
            lastStatusRef.current = serialized;
            setDetectionStatus(status);
          }
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    }, 1000); // Poll every second
  };

  const stopFrameLoop = () => {
    frameLoopActiveRef.current = false;

    if (liveImageRef.current) {
      liveImageRef.current.onload = null;
      liveImageRef.current.onerror = null;
      liveImageRef.current.src = '';
    }

    hasFrameRef.current = false;
    setHasFrame(false);
  };

  const startFrameLoop = () => {
    stopFrameLoop();
    frameLoopActiveRef.current = true;
    const pullFrame = () => {
      if (!frameLoopActiveRef.current) {
        return;
      }

      const img = liveImageRef.current;
      if (!img) {
        setTimeout(pullFrame, 50);
        return;
      }

      img.onload = () => {
        if (!frameLoopActiveRef.current) {
          return;
        }

        if (!hasFrameRef.current) {
          hasFrameRef.current = true;
          setHasFrame(true);
        }

        if (error) {
          setError('');
        }

        setTimeout(pullFrame, 0);
      };

      img.onerror = () => {
        if (!frameLoopActiveRef.current) {
          return;
        }

        setError('Waiting for camera stream connection... (this may take a few seconds)');
        setTimeout(pullFrame, 80);
      };

      img.src = `http://localhost:5001/latest_frame.jpg?t=${Date.now()}`;
    };

    hasFrameRef.current = false;
    setHasFrame(false);
    pullFrame();
  };

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
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Camera:
                  <span className="ml-2 font-semibold">
                    {selectedCameraIndex === null ? 'Not selected' : `Index ${selectedCameraIndex}`}
                  </span>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <select
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                  value={selectedCameraIndex ?? ''}
                  onChange={(e) => setSelectedCameraIndex(Number(e.target.value))}
                  disabled={cameraLoading || isDetectionRunning || cameras.length === 0}
                >
                  {cameraLoading && <option value="">Detecting cameras...</option>}
                  {!cameraLoading && cameras.length === 0 && <option value="">No cameras found</option>}
                  {!cameraLoading && cameras.map((camera) => (
                    <option key={camera.index} value={camera.index}>
                      {camera.label} (index {camera.index})
                    </option>
                  ))}
                </select>
                <button
                  onClick={isDetectionRunning ? stopDetection : startDetection}
                  className={`rounded-xl px-4 py-2 font-medium text-white transition ${isDetectionRunning
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed'
                    }`}
                  disabled={!isDetectionRunning && (cameraLoading || selectedCameraIndex === null)}
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
                <div className="relative bg-black rounded-lg overflow-hidden min-h-[400px] flex items-center justify-center">
                  {isDetectionRunning ? (
                    hasFrame ? (
                      <img 
                        ref={liveImageRef}
                        alt="Camera Live Stream"
                        className="w-full h-auto object-contain"
                        style={{ maxHeight: '600px' }}
                      />
                    ) : (
                      <>
                        <img
                          ref={liveImageRef}
                          alt="Camera Live Stream"
                          className="hidden"
                        />
                        <div className="text-gray-400 text-center py-20">
                          <p>Connecting to camera stream...</p>
                        </div>
                      </>
                    )
                  ) : (
                    <div className="text-gray-400 text-center py-20">
                      <p>Camera feed will appear here when detection is started.</p>
                      <p className="text-sm mt-2">Click "Start Detection" to begin</p>
                    </div>
                  )}
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
