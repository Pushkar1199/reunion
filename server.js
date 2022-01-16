require('dotenv').config();
const { config } = require('dotenv');
const express = require('express');
const app = express();
const bcrypt = require('bcrypt-nodejs');
const cors = require('cors');
const knex = require('knex');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { sendStatus } = require('express/lib/response');
const reg = require('./controllers/register.js')
app.use(express.json());
app.use(cors());
const posts = [
    {
        id: 1,
        username: 'pushkar',
        title: "post 1"
    },
    {
        id: 3,
        username: 'pallavi',
        title: "post 2"
    },
    {
        username: 'tom',
        title: "post tom 3"
    }
]
app.use(bodyParser.json());
const db = knex({
    client: 'pg',
    // connection: {
    //     host: '127.0.0.1',
    //     port: 5432,
    //     user: 'postgres',
    //     password: 'root',
    //     database: 'reunion'

    // }
    connection: {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    }
});

// db.select('*').from('users').then(data => {
//         console.log(data[0]);
//     })


app.post('/regis', (req,res) => {reg.register(req,res,db,bcrypt)});
app.get('/posts', authenticateToken, (req, res) => {

    //console.log(req.user);
    //res.json(req.user);
    res.json(posts.filter(post => post.id === req.user.id));

})

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (token == null) return res.sendStatus(401)

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        //console.log(err);
        if (err) return res.sendStatus(403)
        req.user = user
        next()
    })
}

//1
app.post('/api/authenticate', (req, res) => {
    //auth user

    const { email, password } = req.body;
    //console.log(email,password);

    if (!email || !password) {
        return res.status(400).json("incorrect form submission");
    }
    db.select('email', 'hash').from('login')
        .where('email', '=', email)
        .returning('*')
        .then(data => {
            const isValid = bcrypt.compareSync(password, data[0].hash);
            if (isValid) {
                return db.select('*').from('users')
                    .where('email', '=', email)
                    .returning('*')
                    .then(data => {
                        //res.json(user[0]);
                        const username = data[0].name;
                        const email = data[0].email;
                        const id = data[0].id;
                        console.log(username,email);
                        const user = {
                            name: username,
                            email: email,
                            id: id
                        };
                        const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET);
                        //console.log(accessToken);
                        res.json(accessToken);
                    })
                    .catch(err => 
                        { console.log(err);
                            res.status(400).json("unable to get user")
                        });
            }
            else {
                res.status(400).json("wrong credentialsss")
            }
        })
        .catch(err => res.status(400).json("wrong credentials"));
})

//2
app.post('/api/follow/:id', authenticateToken, (req, res) => {

    const id = req.params.id;
    const follower_id = req.user.id;
    db.select('*').from('user_followers')
        .where('user_id', '=', id)
        .where('follower_id', '=', follower_id)
        .returning("*")
        .then(data => {
            return data.length
        })
        .then(len => {
            if (len) {
                res.json("already followed")
            }
            else {
                db.transaction(trx => {
                    trx.insert({
                        user_id: id,
                        follower_id: follower_id
                    })
                        .into('user_followers')
                        .then(trx.commit)
                        .catch(trx.rollback)
                })
                    .catch(err => res.status(400).json("unable to follow"))
                db('users').where('id', '=', follower_id)
                    .increment('following', 1)
                    .catch(err => sendStatus(400))

                db('users').where('id', '=', id)
                    .increment('followers', 1)
                    .then(res.sendStatus(200))
                    .catch(err => res.sendStatus(400))
            }
        })
        .catch(err => res.status(400).json(err))



    // async function getuser(){
    //     let response = await db.select('*').from('user_followers')
    //     .where('user_id', '=', id)
    //     .where('follower_id', '=', follower_id)
    //     .returning("*")

    //     temp = await response; 
    //     console.log(temp.length)
    // }

    // getuser()
    // .catch(err => console.log(err))

})

//3
app.post('/api/unfollow/:id', authenticateToken, (req, res) => {

    const id = req.params.id;
    const follower_id = req.user.id;
    db.select('*').from('user_followers')
        .where('user_id', '=', id)
        .where('follower_id', '=', follower_id)
        .returning("*")
        .then(data => {
            return data.length
        })
        .then(exist => {
            if (!exist) {
                res.json("no record(s) found");
            }
            else {
                db.transaction(trx => {
                    trx('user_followers').where('user_id', '=', id)
                        .where('follower_id', '=', follower_id)
                        .del()
                        .then(trx.commit)
                        .catch(trx.rollback)
                })
                    .catch(err => res.status(400).json("unable to follow"))
                db('users').where('id', '=', follower_id)
                    .decrement('following', 1)
                    .catch(err => sendStatus(400))

                db('users').where('id', '=', id)
                    .decrement('followers', 1)
                    .then(res.sendStatus(200))
                    .catch(err => res.sendStatus(400))
            }
        })
        .catch(err => res.json(err))

})

//4
app.get('/api/user', authenticateToken, (req, res) => {
    db.select('name', 'followers', 'following')
        .from('users')
        .where('id', '=', req.user.id)
        .where('email', '=', req.user.email)
        .returning('*')
        .then(data => {
            res.json(data)
        })
        .catch(err => console.log(err))
})

//5
app.post('/api/posts/', authenticateToken, (req, res) => {
    const { Title, Description } = req.body;
    const { id, email } = req.user;
    db.transaction(trx => {
        trx.insert({
            email: email,
            post_title: Title,
            descrp: Description,
            created_on: new Date().toISOString(),
            user_id: id
        })
            .into('posts')
            .returning('*')
            .then(data => {
                console.log(data);
                const User = {
                    Post_id: data[0].id,
                    Title: data[0].post_title,
                    Descripion: data[0].descrp,
                    Created_Time: data[0].created_on
                }
                res.json(User)
            })
            .then(trx.commit)
            .catch(trx.rollback)
    })
        .catch(err => console.log(err))


})

//6

app.delete('/api/posts/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    //console.log("idparam",id);
    db.select('id')
        .from('posts')
        .where('user_id', "=", req.user.id)
        .where('id', '=', id)
        .returning('id')
        .then(data => {
            //console.log(data.length)
            if (!data.length) {
                res.json("not found")
            }
        })
        .catch(err => { console.log(err) })

    db.transaction(trx => {
        trx.del()
            .from('posts')
            .where('id', '=', id)
            .then(res.sendStatus(200))
            .then(trx.commit)
            .catch(trx.rollback)
    })
        .catch(err => console.log(err))
})


//7
app.post('/api/like/:id', authenticateToken, (req, res) => {
    //res.json("hello there");
    const { id } = req.params;
    //console.log(id)

    db('posts').where('id', '=', id)
        .increment('likes', 1)
        .then(res.sendStatus(200))
        .catch(err => res.status(400).json(err))
})

//8

app.post('/api/unlike/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db('posts').where('id', '=', id)
        .increment('dislikes', 1)
        .returning('dislikes')
        .then(data => {
            // const out = data[0];
            console.log(data);
            res.sendStatus(200)
        })
        .catch(err => res.status(400).json(err))
})

//9
app.post('/api/comment/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    const comment = req.body.comment;
    db.select('id')
        .from('posts')
        .where('id', '=', id)
        .returning('id')
        .then(ids => {
            //console.log(ids.length);
            if (!ids.length) {
                res.json("no post found")
            }
            else {

                db('comments')
                    .insert({
                        post_id: id,
                        comment: comment,
                        comment_on: new Date().toISOString()
                    })
                    .returning('id')
                    .then(data => {
                        const v = {
                            Comment_Id: data[0]
                        }
                        res.json(v);
                    })
                    .catch(err => res.json(err))
            }
        })
        .catch(err => res.status(400).json(err))

})

//10

app.get('/api/posts/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    let temp = {
        title: '',
        description: '',
        likes: 0,
        comments: 0
    }
    db('posts').select('likes').where('id', '=', id)
        .returning('*')
        .then(data => {
            temp['likes'] = data[0].likes;
            // console.log(temp);
        })
    db('comments').count('id')
        .where('post_id', '=', id)
        .returning('*')
        .then(data => {
            //console.log(data)
            temp['comments'] = parseInt(data[0].count)
        })
    db('posts').select('post_title', 'descrp')
        .where('id', '=', id)
        .returning('*')
        .then(data => {
            temp['title'] = data[0].post_title;
            temp['description'] = data[0].descrp;
            console.log(temp);
            res.json(temp)
        })


})
//11
app.get('/api/all_posts', authenticateToken, (req, res) => {
    
    const user_id = req.user.id
    let postIds = []
    db('posts').select('id').where('user_id', '=', user_id)
        .orderBy('created_on')
        .returning('id')
        .then(data => {
            //console.log(data);
            for (let i = 0; i < data.length; i++) {
                postIds.push(data[i].id);
            }
           // console.log(postIds);
            return postIds;
        })
        .then(() => {
            let result = [];
            console.log(postIds)
            for (let i = 0; i < postIds.length; i++) {
                db('posts').select('id', 'post_title', 'descrp', 'created_on', 'likes')
                    .where('id', '=', postIds[i])
                    .returning('*')
                    .then(data => {
                        const temp = {}
                        temp['id'] = data[0].id;
                        temp['Title'] = data[0].post_title;
                        temp['desc'] = data[0].descrp;
                        temp['created_at'] = data[0].created_on;
                        temp['likes'] = data[0].likes;
                        temp['comments'] = []
                        return temp

                    })
                    .then(temp => {
                        //console.log(temp)
                        return temp;
                    })
                    .then(temp => {
                        db('comments').select('comment')
                            .where('post_id', '=', postIds[i])
                            .returning('*')
                            .then(data => {
                                for (let i = 0; i < data.length; i++) {
                                    temp['comments'].push(data[i].comment);
                                }
                                console.log(temp)
                                result.push(temp)
                                if(i === postIds.length-1)
                                    // console.log(result)
                                    res.json(result)
                            })
                    })
            }
        })


})
app.get('/',(_,res) => {
    res.sendFile(__dirname + "/home.html");
})


app.listen(process.env.PORT || 3000,() => {
    console.log(`app is running at port ${process.env.PORT}`);
})
