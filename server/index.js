import  express  from 'express'
import {Server} from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const ADMIN = "Admin"

const app = express()

app.use(express.static(path.join(__dirname, 'public')))

const expressServer = app.listen(PORT, () => console.log(`Server is running on port ${PORT}`))

// state for users
const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray
    }
}

const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? false : 
        ["http://localhost:5500", "http://127.0.0.1:5500"]
    }
})


io.on ('connection', (socket) => {
    console.log(`User ${socket.id} connected`)

    //uppon connection, send the socket id to the client
    socket.emit('message', buildMsg(ADMIN, `Welcome to the chat ${socket.id.substring(0,5)}`) )//to say the user name with the welcoming message

    socket.on('enterRoom', ({name, room}) => {

        //leave previous room if any, and notify the room he left
        const prevRoom = getUser(socket.id)?.room


        if(prevRoom){
            socket.leave(prevRoom)
            io.to(prevRoom).emit('message', buildMsg(ADMIN, `User ${user.name} has left the room`))  
        }
        const user = activateUser(socket.id, name, room)


        //cannot update prevRoom until after stateupdate
        if ( prevRoom){
            io.to(prevRoom).emit('userList', {
            users: getUsersInRoom(prevRoom)
        })
    }
    socket.join(user.room)

    //to the user who joined
    socket.emit('message', buildMsg(ADMIN, `You've joined the ${user.room} chat room`))

    //to everyone else
    socket.broadcast.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has joined the room`))

    //update the users list for room
    io.to(user.room).emit('userList', {
        users: getUsersInRoom(user.room)
    })

    //update the rooms list
    io.emit('roomList', {
        rooms: getAllActiveRooms()
    })

})

     //when the user is disconnect
     socket.on('disconnect', () => {
        const user = getUser(socket.id)
        userLeavesApp(socket.id)//remove user form state

        if(user){
            io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has left the room`))
            io.to(user.room).emit('userList', {
                users: getUsersInRoom(user.room)
            })

            io.emit('roomList', {
                rooms: getAllActiveRooms()
            })
        }

        console.log(`User ${socket.id} disconnected`)
    })

    //listen for messages event from the client
    socket.on ('message', ({name, text}) => {
        const room = getUser(socket.id)?.room
        if(room){
            io.to(room).emit('message', buildMsg(name, text))
        }
    })  

    //lstening for activity 
    socket.on('activity', (name) =>{ //emit is for sending data to the server for all
        const room = getUser(socket.id)?.room
        if(room){
            socket.broadcast.to(room).emit('activity', name) //broadcast is for sending data to the server for all except the sender
        }
        
    })
})

function buildMsg(name, text){
    return {
        name,
        text,
        time: new Intl.DateTimeFormat('default',{
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).format(new Date())
    } //from javascripts its built in
}

//impact user state//user functions enter,leave ..etc

function activateUser(id, name, room){
    const user = {id, name, room}
    UsersState.setUsers([
        ...UsersState.users.filter(user => user.id !== id),
        user
    ])
    return user
}

function userLeavesApp(id){
    UsersState.setUsers(UsersState.users.filter(user => user.id !== id)
    )
}

//find the user
function getUser(id){
    return UsersState.users.find(user => user.id === id)
}

function getUsersInRoom(room){
    return UsersState.users.filter(user => user.room === room)
}
//return all active rooms with no duplicates
function getAllActiveRooms(){
    return Array.from(new Set(UsersState.users.map(user => user.room)))
}