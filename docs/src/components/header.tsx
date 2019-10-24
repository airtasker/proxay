import styled from "@emotion/styled"
import { Link } from "gatsby"
import React from "react"

const HeaderBar = styled.header`
  background: rebeccapurple;
  margin-bottom: 1.45rem;
`

const HeaderContent = styled.div`
  margin: 0 auto;
  max-width: 960px;
  padding: 1.45rem 1.0875rem;
`

const HeaderLink = styled(Link)`
  color: white;
  text-decoration: none;
`

const H1 = styled.h1`
  margin: 0;
`

const Header = ({ siteTitle = "" }: { siteTitle?: string }) => (
  <HeaderBar>
    <HeaderContent>
      <H1>
        <HeaderLink to="/">{siteTitle}</HeaderLink>
      </H1>
    </HeaderContent>
  </HeaderBar>
)

export default Header
