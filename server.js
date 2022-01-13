require('dotenv').config();
const { config } = require('dotenv');
const express = require('express');
const app = express();
const bcrypt = require('bcrypt-nodejs');
const cors = require('cors');
const knex = require('knex');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken')
app.use(express.json());
const posts = [
    {
        username : 'pushkar',
        title : "post 1"
    },
    {
        username : 'pallavi',
        title : "post 2"
    },
    {
        username : 'tom',
        title : "post tom 3"
    }
]
app.use(bodyParser.json());
const db = knex({
    client: 'pg',
    connection: {
        host: '127.0.0.1',
        port: 5432,
        user: 'postgres',
        password: 'root',
        database: 'reunion'
        
    }
});

// db.select('*').from('users').then(data => {
//         console.log(data[0]);
//     })


app.post('/regis',(req,res) => {

    const { email, name, password } = req.body;
    const hash = bcrypt.hashSync(password);
    if(!email || !name || !password){
        return res.status(400).json("incorrect form submission");
    }

    db.transaction(trx => {
        trx.insert({
            hash: hash,
            email: email
        })
        .into('login')
        .returning('email')
        .then( loginEmail => {
            return trx('users')
            .returning('email')
            .insert({
                name: name,
                email: loginEmail[0],                
                joined: new Date()

            })
            .then(user => {
                res.json(user[0]);//database.users[database.users.length - 1 ]
            })

        })
        .then(trx.commit)
        .catch(trx.rollback)
    })
    .catch(err => res.status(400).json('unable to register')) 

})
app.get('/posts',authenticateToken,(req,res) => {

    //console.log(req.user.name);
    res.json(posts.filter(post => post.username === req.user.name ));
})

function authenticateToken(req,res,next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if(token == null) return res.sendStatus(401)

    jwt.verify(token , process.env.ACCESS_TOKEN_SECRET,(err,user) => {
        //console.log(err);
        if(err) return res.sendStatus(403)
        req.user = user
        next()
    })
}

//1
app.post('/api/authenticate',(req,res) => {
    //auth user

    const { email, password } = req.body;
    //console.log(email,password);

    if (!email || !password) {
        return res.status(400).json("incorrect form submission");
    }
    db.select('email', 'hash').from('login')
        .where('email', '=', email)
        .then(data => {
            const isValid = bcrypt.compareSync(password, data[0].hash);
            if (isValid) {
                return db.select('*').from('users')
                    .where('email', '=', email)
                    .then(data => {
                        //res.json(user[0]);
                        const username = data[0].name;
                        const email = data[0].email;
                        //console.log(username,email);
                        const user = {name : username,
                                    email:email};
                        const accessToken = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET);
                        res.json({accessToken:accessToken});
                    })
                    .catch(err => res.status(400).json("unable to get user"));
            }
            else {
                res.status(400).json("wrong credentialsss")
            }
        })
        .catch(err => res.status(400).json("wrong credentials"));

    
})



app.listen(3000);
