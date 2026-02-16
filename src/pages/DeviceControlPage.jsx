import { useState, useMemo } from 'react';
import ToggleSwitch from '../components/ToggleSwitch';
import RoomVisualization from '../components/RoomVisualization';

// Lab configurations organized by E Block floors
const roomConfigurations = {
  // E Block 1st Floor Labs
  lab1: {
    id: 'lab1',
    name: 'Lab 1 - E Block 1st Floor',
    devices: [
      { id: 'l1-light1', name: 'Main Light 1', type: 'light', position: { x: 100, y: 80 } },
      { id: 'l1-light2', name: 'Main Light 2', type: 'light', position: { x: 300, y: 80 } },
      { id: 'l1-fan1', name: 'Exhaust Fan 1', type: 'fan', position: { x: 200, y: 150 } },
      { id: 'l1-fan2', name: 'Exhaust Fan 2', type: 'fan', position: { x: 100, y: 200 } },
      { id: 'l1-light3', name: 'Workbench Light', type: 'light', position: { x: 300, y: 200 } },
      { id: 'l1-fan3', name: 'Corner Fan', type: 'fan', position: { x: 350, y: 250 } },
    ],
  },
  lab2: {
    id: 'lab2',
    name: 'Lab 2 - E Block 1st Floor',
    devices: [
      { id: 'l2-light1', name: 'Ceiling Light 1', type: 'light', position: { x: 100, y: 100 } },
      { id: 'l2-light2', name: 'Ceiling Light 2', type: 'light', position: { x: 300, y: 100 } },
      { id: 'l2-fan1', name: 'Main Exhaust Fan', type: 'fan', position: { x: 200, y: 150 } },
      { id: 'l2-fan2', name: 'Side Exhaust Fan', type: 'fan', position: { x: 100, y: 220 } },
      { id: 'l2-light3', name: 'Equipment Light', type: 'light', position: { x: 300, y: 220 } },
      { id: 'l2-fan3', name: 'Ventilation Fan', type: 'fan', position: { x: 350, y: 80 } },
    ],
  },
  lab3: {
    id: 'lab3',
    name: 'Lab 3 - E Block 1st Floor',
    devices: [
      { id: 'l3-light1', name: 'Lab Light 1', type: 'light', position: { x: 100, y: 80 } },
      { id: 'l3-light2', name: 'Lab Light 2', type: 'light', position: { x: 300, y: 80 } },
      { id: 'l3-fan1', name: 'Central Fan', type: 'fan', position: { x: 200, y: 150 } },
      { id: 'l3-fan2', name: 'Equipment Fan', type: 'fan', position: { x: 80, y: 220 } },
      { id: 'l3-light3', name: 'Safety Light', type: 'light', position: { x: 300, y: 220 } },
      { id: 'l3-fan3', name: 'Emergency Fan', type: 'fan', position: { x: 350, y: 150 } },
    ],
  },
  // E Block 3rd Floor Labs
  lab4: {
    id: 'lab4',
    name: 'Lab 4 - E Block 3rd Floor',
    devices: [
      { id: 'l4-light1', name: 'Research Light 1', type: 'light', position: { x: 150, y: 100 } },
      { id: 'l4-light2', name: 'Research Light 2', type: 'light', position: { x: 300, y: 100 } },
      { id: 'l4-fan1', name: 'Main Exhaust', type: 'fan', position: { x: 200, y: 150 } },
      { id: 'l4-fan2', name: 'Window Fan', type: 'fan', position: { x: 100, y: 200 } },
      { id: 'l4-light3', name: 'Storage Light', type: 'light', position: { x: 300, y: 200 } },
      { id: 'l4-fan3', name: 'Corner Exhaust', type: 'fan', position: { x: 350, y: 80 } },
    ],
  },
  lab5: {
    id: 'lab5',
    name: 'Lab 5 - E Block 3rd Floor',
    devices: [
      { id: 'l5-light1', name: 'Analysis Light 1', type: 'light', position: { x: 100, y: 80 } },
      { id: 'l5-light2', name: 'Analysis Light 2', type: 'light', position: { x: 300, y: 80 } },
      { id: 'l5-fan1', name: 'Fume Hood Fan 1', type: 'fan', position: { x: 200, y: 150 } },
      { id: 'l5-fan2', name: 'Fume Hood Fan 2', type: 'fan', position: { x: 100, y: 200 } },
      { id: 'l5-fan3', name: 'General Fan', type: 'fan', position: { x: 300, y: 200 } },
      { id: 'l5-light3', name: 'Back Light', type: 'light', position: { x: 200, y: 250 } },
    ],
  },
  lab6: {
    id: 'lab6',
    name: 'Lab 6 - E Block 3rd Floor',
    devices: [
      { id: 'l6-light1', name: 'Computer Lab Light 1', type: 'light', position: { x: 100, y: 80 } },
      { id: 'l6-light2', name: 'Computer Lab Light 2', type: 'light', position: { x: 300, y: 80 } },
      { id: 'l6-fan1', name: 'Server Room Fan', type: 'fan', position: { x: 200, y: 150 } },
      { id: 'l6-fan2', name: 'AC Unit Fan 1', type: 'fan', position: { x: 100, y: 200 } },
      { id: 'l6-fan3', name: 'AC Unit Fan 2', type: 'fan', position: { x: 300, y: 200 } },
      { id: 'l6-light3', name: 'Emergency Light', type: 'light', position: { x: 200, y: 250 } },
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
  const [selectedRoom, setSelectedRoom] = useState('lab1');

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
          <h1 className="text-3xl font-bold text-emerald-700">Lab Control System</h1>
          <p className="text-gray-600">Manage lab equipment and environmental controls</p>
        </div>

        {/* Lab Selector */}
        <div className="w-full md:w-64">
          <label htmlFor="room-select" className="block text-sm font-medium text-gray-700 mb-1">
            Select Lab
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

      {/* Lab Visualization */}
      <div className="card-surface p-6">
        <h2 className="text-xl font-semibold mb-4 text-emerald-800">
          {currentRoom.name} - Equipment Layout
        </h2>
        <div className="bg-gray-50 p-4 rounded-lg">
          <RoomVisualization
            room={currentRoom}
            devices={roomDevices}
            onToggleDevice={toggleDevice}
          />
        </div>
      </div>

      {/* Equipment Controls for Current Lab */}
      <div className="card-surface p-6">
        <h2 className="text-xl font-semibold mb-4 text-emerald-800">
          {currentRoom.name} - Equipment Controls
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roomDevices.map((device) => (
            <div key={device.id} className="p-4 border border-emerald-100 rounded-xl hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{device.name}</h3>
                  <div className="flex items-center mt-1">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${device.enabled ? 'bg-emerald-500' : 'bg-gray-400'
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
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${device.enabled ? 'bg-emerald-500' : 'bg-gray-400'
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
