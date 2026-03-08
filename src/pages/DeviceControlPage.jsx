import { useMemo, useState } from 'react';
import RoomVisualization from '../components/RoomVisualization';
import ToggleSwitch from '../components/ToggleSwitch';

const roomConfigurations = {
  'test-lab': {
    id: 'test-lab',
    name: 'Test Lab (Simulation)',
    devices: [
      { id: 'test-device-1', name: 'Test Device 1', type: 'light', position: { x: 200, y: 150 } },
    ],
  },
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
      { id: 'l2-fan3', name: 'Fan', type: 'fan', position: { x: 350, y: 80 } },
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

const initializeDevices = () => {
  const allDevices = [];
  Object.values(roomConfigurations).forEach((room) => {
    room.devices.forEach((device) => {
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

  // Get the selected lab from localStorage
  const selectedLabId = localStorage.getItem('kratos_lab_id');
  const currentRoom = roomConfigurations[selectedLabId] || roomConfigurations.lab1;

  const roomDevices = useMemo(
    () => devices.filter((device) => device.zone === currentRoom.name),
    [devices, currentRoom.name]
  );

  const toggleDevice = async (deviceId, newState) => {
    // Check if this is the test lab device
    const selectedLabId = localStorage.getItem('kratos_lab_id');
    const isTestLab = selectedLabId === 'test-lab';

    setDevices((prevDevices) =>
      prevDevices.map((device) =>
        device.id === deviceId
          ? { ...device, enabled: newState, status: newState ? 'Active' : 'Inactive' }
          : device
      )
    );

    // Send hardware control request for test lab
    if (isTestLab && deviceId === 'test-device-1') {
      try {
        const endpoint = newState ? '/on' : '/off';
        await fetch(`http://192.168.0.100${endpoint}`, {
          method: 'GET',
          mode: 'no-cors'
        });
        // Note: no-cors mode means we won't get response details
      } catch (error) {
        // Silently handle hardware errors - device state still updates in UI
        console.log('Hardware control attempted (device may be offline)');
      }
    }
  };

  return (
    <div className="space-y-8 p-4">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-emerald-700">Lab Control System</h1>
          <p className="text-gray-600">Manage lab equipment and environmental controls</p>
        </div>
      </div>

      <div className="card-surface p-6">
        <h2 className="mb-4 text-xl font-semibold text-emerald-800">
          {currentRoom.name} - Equipment Layout
        </h2>
        <div className="rounded-lg bg-gray-50 p-4">
          <RoomVisualization room={currentRoom} devices={roomDevices} onToggleDevice={toggleDevice} />
        </div>
      </div>

      <div className="card-surface p-6">
        <h2 className="mb-4 text-xl font-semibold text-emerald-800">
          {currentRoom.name} - Equipment Controls
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roomDevices.map((device) => (
            <div
              key={device.id}
              className="rounded-xl border border-emerald-100 p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{device.name}</h3>
                  <div className="mt-1 flex items-center">
                    <span
                      className={`mr-2 inline-block h-2 w-2 rounded-full ${device.enabled ? 'bg-emerald-500' : 'bg-gray-400'
                        }`}
                    />
                    <span className="text-sm text-gray-600">{device.enabled ? 'Active' : 'Inactive'}</span>
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
                    <span className="mr-1 h-2 w-2 rounded-full bg-yellow-400" />
                    Light
                  </span>
                ) : (
                  <span className="flex items-center">
                    <span className="mr-1 h-2 w-2 rounded-full bg-blue-400" />
                    Fan
                  </span>
                )}
                <span className="mx-2">&bull;</span>
                <span>Zone: {device.zone}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
