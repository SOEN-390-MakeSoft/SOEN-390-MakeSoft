import { createTamagui } from 'tamagui'
import { config } from '@tamagui/config/v3'

export default createTamagui({
    ...config,

    themes: {
        light: {
            cred: '#912338', // Concordia red 
              colourBlind1: '#B3D4FF', // inside building color
              colourBlind2: '#1F4E8C', // building border color
        },
    },

})
