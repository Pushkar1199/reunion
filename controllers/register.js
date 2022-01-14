const register = (req, res, db, bcrypt) => {

    const { email, name, password } = req.body;
    const hash = bcrypt.hashSync(password);
    if (!email || !name || !password) {
        return res.status(400).json("incorrect form submission");
    }

    db.transaction(trx => {
        trx.insert({
            hash: hash,
            email: email
        })
            .into('login')
            .returning('email')
            .then(loginEmail => {
                return trx('users')
                    .returning('email')
                    .insert({
                        name: name,
                        email: loginEmail[0],
                        joined: new Date().toISOString()

                    })
                    .then(user => {
                        res.json(user[0]);//database.users[database.users.length - 1 ]
                    })

            })
            .then(trx.commit)
            .catch(trx.rollback)
    })
        .catch(err => res.status(400).json('unable to register'))

}
module.exports = ({
    register : register
})