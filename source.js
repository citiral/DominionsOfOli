let cv = document.getElementById("canvas")

const STATE_IDLE = 1
const STATE_FALLING_PRE = 2
const STATE_FADING_PRE = 3
const STATE_PUSHING = 4
const STATE_FALLING_POST = 5
const STATE_FADING_POST = 6
const STATE_GAME_OVER = 7




let game = {
    general: {
        blockSize: Math.min(document.body.scrollHeight / 11, document.body.scrollWidth / 8),
        colors: [
            "red",
            "green",
            "orange",
            "purple",
            "yellow",
            "blue",
        ]
    },

    state: STATE_IDLE,

    settings: {
        width: 8,
        height: 10,
        speed: 1000/60,
        holeChance: 0.25,
        joinChance: 0.5,
    },

    interation: {
        isDragging: false,
        dragTarget: null,
        dragStart: 0,
        dragNow: 0,
    },

    animation: {
        isAnimating: false,
        animationTime: 0,
        animations: [],
    },

    currentBlocks: [],

    nextLine: []
}

cv.width = game.settings.width * game.general.blockSize
cv.height = (game.settings.height + 1) * game.general.blockSize

let ctx = cv.getContext("2d")

function drawRect(x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill
    ctx.strokeStyle = stroke
    ctx.globalAlpha = 1
    ctx.fillRect(x * game.general.blockSize, (game.settings.height - 1 - y) * game.general.blockSize, w * game.general.blockSize, h * game.general.blockSize)
    ctx.strokeRect(x * game.general.blockSize, (game.settings.height - 1 - y) * game.general.blockSize, w * game.general.blockSize, h * game.general.blockSize)
}

function drawBlock(block) {
    ctx.fillStyle = block.color
    ctx.strokeStyle =  'grey'
    ctx.globalAlpha = 1

    let extraX = 0
    let extraY = 0

    if (game.interation.isDragging && block == game.interation.dragTarget) {
        extraX = game.interation.dragNow - game.interation.dragStart
    }

    if (game.animation.isAnimating) {
        let animation = game.animation.animations.find(anim => anim.target == block)
        if (animation != null && animation.type == 'fall') {
            let time = (animation.duration - game.animation.animationTime)
            if (time < 0) {
                time = 0
            }
            extraY += animation.direction * time * game.general.blockSize
        } else if (animation != null && animation.type == 'fade') {
            ctx.globalAlpha = (1 - game.animation.animationTime / animation.duration )
        }
    }

    ctx.fillRect(block.offset * game.general.blockSize + extraX, (game.settings.height - 1 -  block.line) * game.general.blockSize + extraY,  block.width * game.general.blockSize, game.general.blockSize)
    ctx.strokeRect(block.offset * game.general.blockSize + extraX, (game.settings.height - 1 -  block.line) * game.general.blockSize + extraY,  block.width * game.general.blockSize, game.general.blockSize)
}

function generateNextLine(holeChance, joinChance) {
    game.nextLine = []
    let runLength = 0
    hasHoles = false
    for (let x = 0 ; x < game.settings.width ; x++) {
        let isHole =  Math.random() < holeChance
        hasHoles |= isHole

        if (isHole && runLength > 0) {
            let color = Math.floor(Math.random() * game.general.colors.length)
            game.nextLine.push({
                width: runLength,
                line: -1,
                offset: x - runLength,
                color: game.general.colors[color]
            })
            runLength = 0
        } else if (((!isHole) && (x + 1) == game.settings.width) || (runLength > 0 && Math.random() < joinChance)) {
            let color = Math.floor(Math.random() * game.general.colors.length)
            game.nextLine.push({
                width: runLength + 1,
                line: -1,
                offset: x - runLength,
                color: game.general.colors[color]
            })
            runLength = 0
        } else if (!isHole) {
            runLength++
        }
    }

    if (!hasHoles) {
        generateNextLine(holeChance, joinChance)
    }
}

cv.addEventListener("pointerdown", (event) => {
    if (game.state == STATE_IDLE) {
        let rect = cv.getBoundingClientRect()

        let clickX = Math.floor((event.clientX - rect.left) / game.general.blockSize)
        let clickY = Math.floor((rect.bottom - event.clientY - rect.top) / game.general.blockSize) - 1

        target = game.currentBlocks.find(block => block.line == clickY && block.offset <= clickX && block.offset + block.width > clickX)
        if (target != null) {
            game.interation.isDragging = true
            game.interation.dragStart = event.clientX
            game.interation.dragNow = event.clientX
            console.log(event.clientX)
            game.interation.dragTarget = target
        }
    }
})

cv.addEventListener("pointerup", (event) => {
    console.log(event)
    if (game.state == STATE_IDLE && game.interation.isDragging) {
        game.interation.isDragging = false

        offsetPixels = game.interation.dragNow - game.interation.dragStart
        offsetGrid = Math.round(offsetPixels / game.general.blockSize)
        console.log(offsetPixels)

        console.log(offsetGrid)
        doMoveBlockAction(game.interation.dragTarget, game.interation.dragTarget.offset + offsetGrid)
    }
})

cv.addEventListener("pointermove", (event) => {
    console.log(event.clientX)
    if (game.state == STATE_IDLE) {
        game.interation.dragNow = event.clientX
    }
})

function doMoveBlockAction(block, targetPosition) {
    if (targetPosition < 0 || targetPosition + block.width > game.settings.width || block.offset == targetPosition) {
        return
    }

    if (block.offset < targetPosition) {
        for (x = block.offset ; x <= targetPosition ; x++) {
            if (wouldBlockOverlap(block, block.line, x)) {
                return
            }
        }
    } else if (block.offset > targetPosition) {
        for (x = targetPosition; x <= block.offset ; x++) {
            if (wouldBlockOverlap(block, block.line, x)) {
                return
            }
        }
    }
    
    block.offset = targetPosition
    advanceGameState()
}

function doFallingAnimations() {
    hasFalling = false
    for (line = 0 ; line <= game.settings.height ; line++) {
        game.currentBlocks.forEach(block => {
            if (block.line == line) {
                best = block.line
                for (y = block.line - 1 ; y >= 0 ; y--) {
                    if (wouldBlockOverlap(block, y, block.offset)) {
                        break;
                    } else {
                        best = y
                    }
                }
        
                if (best != block.line) {    
                    game.animation.animations.push({
                        type: 'fall',
                        target: block,
                        direction: -1,
                        duration: block.line - best,
                    })
                    block.line -= block.line - best
                    hasFalling = true
                }
            }
        })
    }
    game.animation.isAnimating = hasFalling
    return hasFalling
}

function doFadingAnimations() {
    hasFading = false
    for (line = 0 ; line < game.settings.height ; line++) {
        let blocks = game.currentBlocks.filter(block => block.line == line)

        fadeLine = true
        for (x = 0 ; x < game.settings.width ; x++) {
            if (!blocks.some(block => block.offset <= x && block.offset + block.width - 1 >= x)) {
                fadeLine = false
            }
        }

        if (fadeLine) {
            blocks.forEach(block => {
                hasFading = true
                game.animation.animations.push({
                    type: 'fade',
                    target: block,
                    duration: 2
                })
            })
        }
    }

    game.animation.isAnimating = hasFading
    return hasFading
}

function doBlockUpAnimations() {
    game.animation.isAnimating = true
    game.nextLine.forEach(block => {
        game.currentBlocks.push(block)
    })

    generateNextLine(game.settings.holeChance, game.settings.joinChance)

    game.currentBlocks.forEach(block => {
        game.animation.animations.push({
            type: 'fall',
            target: block,
            direction: 1,
            duration: 1,
        })
        block.line += 1
    })

    return true
}

function advanceGameState() {
    game.animation.isAnimating = false
    game.animation.animationTime = 0
    game.animation.animations = []

    if (game.currentBlocks.some(block => block.line == 10)) {
        game.state = STATE_GAME_OVER
    }

    if (game.state == STATE_IDLE || game.state == STATE_FADING_PRE) {
        if (doFallingAnimations()) {
            game.state = STATE_FALLING_PRE
        } else {
            if (doFadingAnimations()) {
                game.state = STATE_FADING_PRE
            } else {
                doBlockUpAnimations()
                game.state = STATE_PUSHING
            }
        }
    } else if (game.state == STATE_FALLING_PRE) {
        if (doFadingAnimations()) {
            game.state = STATE_FADING_PRE
        } else {
            doBlockUpAnimations()
            game.state = STATE_PUSHING
        }
    }
    else if (game.state == STATE_PUSHING || game.state == STATE_FADING_POST) {
        if (doFallingAnimations()) {
            game.state = STATE_FALLING_POST
        } else {
            if (doFadingAnimations()) {
                game.state = STATE_FADING_POST
            } else {
                game.state = STATE_IDLE

                if (game.currentBlocks.length == 0) {
                    doBlockUpAnimations()
                    game.state = STATE_PUSHING
                }
            }
        }
    } else if (game.state == STATE_FALLING_POST) {
        if (doFadingAnimations()) {
            game.state = STATE_FADING_POST
        } else {
            game.state = STATE_IDLE

            if (game.currentBlocks.length == 0) {
                doBlockUpAnimations()
                game.state = STATE_PUSHING
            }
        }
    }

    console.log("advanced to: " + game.state)
}

function commitAnimations() {
    game.animation.isAnimating = false

    let toRemove = game.animation.animations
                    .filter(anim => anim.type == 'fade')
                    .map(anim => anim.target)
    
    game.currentBlocks = game.currentBlocks.filter(block => !toRemove.includes(block))

    game.animation.animations = []
}

function wouldBlockOverlap(block, line, pos) {
    return game.currentBlocks.some(other => 
        other != block &&
        other.line == line &&
        other.offset + other.width - 1 >= pos &&
        other.offset <= pos + block.width - 1
    )
}


setInterval(() => {
    if (game.animation.isAnimating) {
        game.animation.animationTime += game.settings.speed / 1000
        if (game.animation.animations.every(animation => animation.duration <= game.animation.animationTime)) {
            commitAnimations()
            advanceGameState()
        }
    }

    for (let x = 0; x < game.settings.width ; x++) {
        for (let y = -1 ; y < game.settings.height ; y++) {
            drawRect(x, y, 1, 1, 'black', 'grey')
        }
    }

    game.nextLine.forEach(block => {
        drawRect(block.offset, block.line, block.width, 1, 'grey', 'black')
    })
    
    game.currentBlocks.forEach(block => {
        drawBlock(block)
    })
}, game.speed);

generateNextLine(game.settings.holeChance, game.settings.joinChance)
advanceGameState()