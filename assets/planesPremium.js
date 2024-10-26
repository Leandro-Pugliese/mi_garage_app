const express = require('express');

//Planes mensuales, semestrales(15%off), anuales(30%off).

const plansList = [
    {
        name: 'Basic',
        description: '1 mes de membresía premium Basic (Mi Garage App)',
        amount: 1250,
        months: 1,
        type: 'Basic'
    },
    {
        name: 'Plus',
        description: '1 mes de membresía premium Plus (Mi Garage App)',
        amount: 2800,
        months: 1,
        type: 'Plus'
    },
    {
        name: 'Basic semestral',
        description: '6 meses de membresía premium Basic (Mi Garage App)',
        amount: 6375,
        months: 6,
        type: 'Basic'
    },
    {
        name: 'Plus semestral',
        description: '6 meses de membresía premium Plus (Mi Garage App)',
        amount: 14280,
        months: 6,
        type: 'Plus'
    },
    {
        name: 'Basic anual',
        description: '12 meses de membresía premium Basic (Mi Garage App)',
        amount: 10500,
        months: 12,
        type: 'Basic'
    },
    {
        name: 'Plus anual',
        description: '12 meses de membresía premium Plus (Mi Garage App)',
        amount: 23520,
        months: 12,
        type: 'Plus'
    }
]

module.exports = {plansList}