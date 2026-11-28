/*
    I want to add the option for the user to download their current player through
    to their device as a file (a custom file '.malengine')
    The file data should be encypted to prevent user modification.
    There should be a button on the pause menu to save progress labeled as "Save to Device"; pressing this should prompt the user for a file save location. 
*/

const levelData = {
    require:[
        'seed',
        'player',
        'zones.map#changes',
        'game.date',
        'game.time',
        'zones.entities',
    ]
};

