import { FaLightbulb, FaFan, FaVideo } from 'react-icons/fa';

const RoomVisualization = ({ room, devices, onToggleDevice }) => {
  // Room dimensions (in arbitrary units)
  const roomWidth = 400;
  const roomHeight = 300;
  const wallThickness = 2;
  
  // Camera position - one per room in different corners
  const cameraPositions = [
    // Each room will use one of these positions based on room ID hash
    { x: 30, y: 30, angle: 135 }, // Top-left
    { x: roomWidth - 30, y: 30, angle: 225 }, // Top-right
    { x: 30, y: roomHeight - 30, angle: 45 }, // Bottom-left
    { x: roomWidth - 30, y: roomHeight - 30, angle: 315 } // Bottom-right
  ];
  
  // Select one camera position based on room ID hash
  const roomCameraIndex = (room.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 4);
  const roomCamera = [cameraPositions[roomCameraIndex]];

  const getDeviceStatus = (id) => {
    const device = devices.find(d => d.id === id);
    return device ? device.enabled : false;
  };

  const handleDeviceClick = (deviceId) => {
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      onToggleDevice(deviceId, !device.enabled);
    }
  };

  const DeviceIcon = ({ type, enabled, x, y, id }) => {
    const baseStyle = {
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      transform: 'translate(-50%, -50%)',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      filter: enabled ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))' : 'none',
    };

    const iconStyle = {
      color: enabled ? '#10B981' : '#9CA3AF',
      fontSize: type === 'light' ? '24px' : '28px',
    };

    return (
      <div 
        style={baseStyle}
        onClick={() => handleDeviceClick(id)}
        className="device-icon"
        title={`${type} - ${enabled ? 'On' : 'Off'}`}
      >
        {type === 'light' ? (
          <FaLightbulb style={iconStyle} />
        ) : (
          <FaFan className={enabled ? 'animate-spin' : ''} style={iconStyle} />
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto mt-8">
      <div 
        className="relative bg-gray-50 rounded-lg overflow-hidden"
        style={{
          width: `${roomWidth}px`,
          height: `${roomHeight}px`,
          margin: '0 auto',
          border: `${wallThickness}px solid #10B981`,
          position: 'relative',
          backgroundImage: 'linear-gradient(#10B981 1px, transparent 1px), linear-gradient(90deg, #10B981 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        {/* Room walls */}
        <div 
          className="absolute bg-white bg-opacity-70"
          style={{
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: `${wallThickness}px solid #10B981`,
            borderRadius: '0.5rem',
          }}
        >
          {/* Camera indicator */}
          {roomCamera.map((camera, index) => (
            <div 
              key={`camera-${index}`}
              className="absolute flex flex-col items-center"
              style={{
                left: `${camera.x}px`,
                top: `${camera.y}px`,
                transform: 'translate(-50%, -50%)',
                color: '#3B82F6',
                fontSize: '16px',
              }}
              title={`Camera ${index + 1}`}
            >
              <FaVideo className="mb-1" />
              <div 
                className="w-1 h-4 bg-blue-500"
                style={{
                  transform: `rotate(${camera.angle}deg)`,
                  transformOrigin: 'center bottom',
                }}
              ></div>
            </div>
          ))}
          
          {/* Device icons */}
          {room.devices.map((device) => (
            <DeviceIcon
              key={device.id}
              type={device.type}
              enabled={getDeviceStatus(device.id)}
              x={device.position.x}
              y={device.position.y}
              id={device.id}
            />
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        <div className="flex items-center">
          <FaLightbulb className="text-yellow-500 mr-2" />
          <span>Lights</span>
        </div>
        <div className="flex items-center">
          <FaFan className="text-emerald-500 mr-2" />
          <span>Fans</span>
        </div>
        <div className="flex items-center">
          <FaVideo className="text-blue-500 mr-2" />
          <span>Security Cameras</span>
        </div>
      </div>
      <div className="text-center text-sm text-gray-500 mt-2">
        Viewing: {room.name} | Cameras: 1 active
      </div>
    </div>
  );
};

export default RoomVisualization;
