// Generated Hotspot Configuration
// This file contains hotspot data created with the Hotspot Editor

// Panorama Hotspots Data Configuration
export const hotspotData = [
  {
    theta: 0.2800,
    phi: 1.7287,
    radius: 480,
    color: 0xff6600,
    name: 'Breakfast Nook',
    description: '',
    panoramaImage: 'TaskID_0001/Breakfast Nook.jpg',
    fromRoom: 'Living Room'
  },
  {
    theta: -1.2600,
    phi: 1.7043,
    radius: 480,
    color: 0xff6600,
    name: 'Hallway',
    description: '',
    panoramaImage: 'TaskID_0001/Hallway.jpg',
    fromRoom: 'Living Room'
  },
  {
    theta: -0.1300,
    phi: 1.8359,
    radius: 480,
    color: 0xff6600,
    name: 'Living Room',
    description: '',
    panoramaImage: 'TaskID_0001/Living Room.jpg',
    fromRoom: 'Breakfast Nook'
  }
];

// Room adjacency system
export const roomConnections = {
  'Bathroom': [],
  'Bedroom 1': [],
  'Bedroom 2': [],
  'Breakfast Nook': ['Living Room'],
  'Closet': [],
  'Hallway': [],
  'Kitchen': [],
  'Living Room': ['Breakfast Nook', 'Hallway']
};

// Available panorama images
export const availablePanoramas = [
  'TaskID_0001/Bathroom.jpg',
  'TaskID_0001/Bedroom 1.jpg',
  'TaskID_0001/Bedroom 2.jpg',
  'TaskID_0001/Breakfast Nook.jpg',
  'TaskID_0001/Closet.jpg',
  'TaskID_0001/Hallway.jpg',
  'TaskID_0001/Kitchen.jpg',
  'TaskID_0001/Living Room.jpg',
  //Floor 2
  'TaskID_0001/Bedroom3.jpg',
  'TaskID_0001/Hallway 2.jpg'
  
  
];

// 3D Model to Panorama Mapping Configuration
export const modelToPanoramaMapping = [
  {
    nodeNamePatterns: ['bathroom'],
    fallbackIndex: 0,
    panoramaImage: 'TaskID_0001/Bathroom.jpg',
    displayName: 'Bathroom'
  },
  {
    nodeNamePatterns: ['bedroom_1'],
    fallbackIndex: 1,
    panoramaImage: 'TaskID_0001/Bedroom 1.jpg',
    displayName: 'Bedroom 1'
  },
  {
    nodeNamePatterns: ['bedroom_2'],
    fallbackIndex: 2,
    panoramaImage: 'TaskID_0001/Bedroom 2.jpg',
    displayName: 'Bedroom 2'
  },
  {
    nodeNamePatterns: ['breakfast_nook'],
    fallbackIndex: 3,
    panoramaImage: 'TaskID_0001/Breakfast Nook.jpg',
    displayName: 'Breakfast Nook'
  },
  {
    nodeNamePatterns: ['closet'],
    fallbackIndex: 4,
    panoramaImage: 'TaskID_0001/Closet.jpg',
    displayName: 'Closet'
  },
  {
    nodeNamePatterns: ['hallway'],
    fallbackIndex: 5,
    panoramaImage: 'TaskID_0001/Hallway.jpg',
    displayName: 'Hallway'
  },
  {
    nodeNamePatterns: ['kitchen'],
    fallbackIndex: 6,
    panoramaImage: 'TaskID_0001/Kitchen.jpg',
    displayName: 'Kitchen'
  },
  {
    nodeNamePatterns: ['living_room'],
    fallbackIndex: 7,
    panoramaImage: 'TaskID_0001/Living Room.jpg',
    displayName: 'Living Room'
  },
  {
    nodeNamePatterns: ['hallway2'],
    fallbackIndex: 7,
    panoramaImage: 'TaskID_0001/Hallway 2.jpg',
    displayName: 'Hallwaway 2'
  },
  {
    nodeNamePatterns: ['bedroom_3'],
    fallbackIndex: 7,
    panoramaImage: 'TaskID_0001/Bedroom3.jpg',
    displayName: 'Bedroom 3'
  }
];