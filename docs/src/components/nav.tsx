import styled from "@emotion/styled"
import { Location } from "@reach/router"
import { Link } from "gatsby"
import React from "react"
import { PAGES } from "../config/pages"

const NavContainer = styled.nav`
  display: flex;
  flex-direction: row;
  justify-content: center;
`

const ButtonLink = styled(Link)<{ active: boolean }>`
  background: #fff;
  font-weight: ${props => (props.active ? "bold" : "normal")};
  border: 1px solid #eee;
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.2);
  padding: 8px;
  margin: 4px;
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  color: #333;
  transition: box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;

  &:hover {
    box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.5);
    color: #000;
  }
`

export const Nav = () => {
  return (
    <NavContainer>
      <Location>
        {locationProps => (
          <>
            {Object.entries(PAGES).map(([path, label]) => (
              <ButtonLink
                key={path}
                to={path}
                active={locationProps.location.pathname === path}
              >
                {label}
              </ButtonLink>
            ))}
          </>
        )}
      </Location>
    </NavContainer>
  )
}
