import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import feather from "feather-icons";
import { Amplify } from "aws-amplify";
import { signIn, fetchAuthSession } from "aws-amplify/auth";

export default function Signup() {
    return (
        <div>Signup</div>
    );
}

