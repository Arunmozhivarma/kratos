import { useState, useMemo } from 'react';
import ToggleSwitch from '../components/ToggleSwitch';
import RoomVisualization from '../components/RoomVisualization';

// Room configurations with different layouts
const roomConfigurations = {
  livingRoom: {
    id: 'livingRoom',
    name: 'Living Room',
    devices: [
      { id: 'lr-light1', name: 'Main Light 1', type: 'light', position: { x: 100, y: 80 } },
      { id: 'lr-light2', name: 'Main Light 2', type: 'light', position: { x: 300, y: 80 } },
      { id: 'lr-fan1', name: 'Center Fan', type: 'fan', position: { x: 200, y: 150 } },
      { id: 'lr-fan2', name: 'Side Fan', type: 'fan', position: { x: 100, y: 200 } },
      { id: 'lr-light3', name: 'Reading Light', type: 'light', position: { x: 300, y: 200 } },
      { id: 'lr-fan3', name: 'Corner Fan', type: 'fan', position: { x: 350, y: 250 } },
    ],
  },
  bedroom: {
    id: 'bedroom',
    name: 'Bedroom',
    devices: [
      { id: 'br-light1', name: 'Bedside Light 1', type: 'light', position: { x: 100, y: 100 } },
      { id: 'br-light2', name: 'Bedside Light 2', type: 'light', position: { x: 300, y: 100 } },
      { id: 'br-fan1', name: 'Main Fan', type: 'fan', position: { x: 200, y: 150 } },
      { id: 'br-fan2', name: 'Dressing Fan', type: 'fan', position: { x: 100, y: 220 } },
      { id: 'br-light3', name: 'Dressing Light', type: 'light', position: { x: 300, y: 220 } },
      { id: 'br-fan3', name: 'Corner Fan', type: 'fan', position: { x: 350, y: 80 } },
    ],
  },
  kitchen: {
    id: 'kitchen',
    name: 'Kitchen',
    devices: [
      { id: 'kt-light1', name: 'Ceiling Light 1', type: 'light', position: { x: 100, y: 80 } },
      { id: 'kt-light2', name: 'Ceiling Light 2', type: 'light', position: { x: 300, y: 80 } },
      { id: 'kt-fan1', name: 'Dining Fan', type: 'fan', position: { x: 200, y: 150 } },
      { id: 'kt-fan2', name: 'Cooking Fan', type: 'fan', position: { x: 80, y: 220 } },
      { id: 'kt-light3', name: 'Counter Light', type: 'light', position: { x: 300, y: 220 } },
      { id: 'kt-fan3', name: 'Island Fan', type: 'fan', position: { x: 350, y: 150 } },
    ],
  },
  office: {
    id: 'office',
    name: 'Home Office',
    devices: [
      { id: 'of-light1', name: 'Desk Light', type: 'light', position: { x: 150, y: 100 } },
      { id: 'of-light2', name: 'Ceiling Light', type: 'light', position: { x: 300, y: 100 } },
      { id: 'of-fan1', name: 'Main Fan', type: 'fan', position: { x: 200, y: 150 } },
      { id: 'of-fan2', name: 'Window Fan', type: 'fan', position: { x: 100, y: 200 } },
      { id: 'of-light3', name: 'Shelf Light', type: 'light', position: { x: 300, y: 200 } },
      { id: 'of-fan3', name: 'Corner Fan', type: 'fan', position: { x: 350, y: 80 } },
    ],
  },
  mediaRoom: {
    id: 'mediaRoom',
    name: 'Media Room',
    devices: [
      { id: 'mr-light1', name: 'Ambient Light 1', type: 'light', position: { x: 100, y: 80 } },
      { id: 'mr-light2', name: 'Ambient Light 2', type: 'light', position: { x: 300, y: 80 } },
      { id: 'mr-fan1', name: 'Main Fan', type: 'fan', position: { x: 200, y: 150 } },
      { id: 'mr-fan2', name: 'Side Fan 1', type: 'fan', position: { x: 100, y: 200 } },
      { id: 'mr-fan3', name: 'Side Fan 2', type: 'fan', position: { x: 300, y: 200 } },
      { id: 'mr-light3', name: 'Backlight', type: 'light', position: { x: 200, y: 250 } },
    ],
  },
};

// Initialize all devices with default status
const initializeDevices = () => {
  const allDevices = [];
  Object.values(roomConfigurations).forEach(room => {
    room.devices.forEach(device => {
      allDevices.push({
        ...device,
        zone: room.name,
        status: 'Inactive',
        enabled: false,
      });
    });
  });
  return allDevices;
};

export default function DeviceControlPage() {
  const [devices, setDevices] = useState(initializeDevices());
  const [selectedRoom, setSelectedRoom] = useState('livingRoom');
  
  const currentRoom = roomConfigurations[selectedRoom];
  const roomDevices = useMemo(() => 
    devices.filter(device => device.zone === currentRoom.name),
    [devices, currentRoom.name]
  );

  const toggleDevice = (deviceId, newState) => {
    setDevices(prevDevices => 
      prevDevices.map(device => 
        device.id === deviceId 
          ? { ...device, enabled: newState, status: newState ? 'Active' : 'Inactive' }
          : device
      )
    );
  };

  const toggleDeviceByName = (deviceName, newState) => {
    setDevices(prevDevices => 
      prevDevices.map(device => 
        device.name === deviceName 
          ? { ...device, enabled: newState, status: newState ? 'Active' : 'Inactive' }
          : device
      )
    );
  };

  // Group all devices by zone for the device list
  const devicesByZone = useMemo(() => 
    devices.reduce((acc, device) => {
      if (!acc[device.zone]) {
        acc[device.zone] = [];
      }
      acc[device.zone].push(device);
      return acc;
    }, {}),
    [devices]
  );

  return (
    <div className="space-y-8 p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-700">Smart Home Control</h1>
          <p className="text-gray-600">Manage your home devices and lighting</p>
        </div>
        
        {/* Room Selector */}
        <div className="w-full md:w-64">
          <label htmlFor="room-select" className="block text-sm font-medium text-gray-700 mb-1">
            Select Room
          </label>
          <select
            id="room-select"
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {Object.values(roomConfigurations).map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Room Visualization */}
      <div className="card-surface p-6">
        <h2 className="text-xl font-semibold mb-4 text-emerald-800">
          {currentRoom.name} - Device Layout
        </h2>
        <div className="bg-gray-50 p-4 rounded-lg">
          <RoomVisualization 
            room={currentRoom}
            devices={roomDevices}
            onToggleDevice={toggleDevice} 
          />
        </div>
      </div>

      {/* Device Controls for Current Room */}
      <div className="card-surface p-6">
        <h2 className="text-xl font-semibold mb-4 text-emerald-800">
          {currentRoom.name} - Device Controls
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roomDevices.map((device) => (
            <div key={device.id} className="p-4 border border-emerald-100 rounded-xl hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{device.name}</h3>
                  <div className="flex items-center mt-1">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      device.enabled ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}></span>
                    <span className="text-sm text-gray-600">
                      {device.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <ToggleSwitch 
                  checked={device.enabled} 
                  onChange={(val) => toggleDevice(device.id, val)} 
                  id={`toggle-${device.id}`}
                />
              </div>
              <div className="mt-3 flex items-center text-sm text-gray-500">
                {device.type === 'light' ? (
                  <span className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 mr-1"></span>
                    Light
                  </span>
                ) : (
                  <span className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-blue-400 mr-1"></span>
                    Fan
                  </span>
                )}
                <span className="mx-2">•</span>
                <span>Zone: {device.zone}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* All Devices List */}
      <div className="card-surface p-6">
        <h2 className="text-xl font-semibold mb-4 text-emerald-800">All Devices</h2>
        {Object.entries(devicesByZone).map(([zone, zoneDevices]) => (
          <div key={zone} className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-3 border-b pb-2">{zone}</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {zoneDevices.map((device) => (
                <div key={device.id} className="p-4 border border-gray-100 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800">{device.name}</h3>
                      <div className="flex items-center mt-1">
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          device.enabled ? 'bg-emerald-500' : 'bg-gray-400'
                        }`}></span>
                        <span className="text-sm text-gray-600">
                          {device.enabled ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <ToggleSwitch 
                      checked={device.enabled} 
                      onChange={(val) => toggleDevice(device.id, val)} 
                      id={`toggle-all-${device.id}`}
                    />
                  </div>
                  <div className="mt-3 flex items-center text-sm text-gray-500">
                    {device.type === 'light' ? (
                      <span className="flex items-center">
                        <span className="w-2 h-2 rounded-full bg-yellow-400 mr-1"></span>
                        Light
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <span className="w-2 h-2 rounded-full bg-blue-400 mr-1"></span>
                        Fan
                      </span>
                    )}
                    <span className="mx-2">•</span>
                    <span>Zone: {device.zone}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
